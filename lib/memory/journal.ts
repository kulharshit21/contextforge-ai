import { createHash, randomBytes } from "node:crypto";
import { open, readFile, unlink, writeFile, rename, lstat } from "node:fs/promises";
import path from "node:path";

import { ensureDir, pathExists } from "../utils/fs";
import {
  type JournalEvent,
  type JournalEventKind,
  JournalEventSchema,
} from "./schemas";

const VERSION = 1;
const LOCK_TIMEOUT_SECONDS = 60;
const VALID_ID_REGEX = /^[a-f0-9]{12}$/;
const VALID_TAG_REGEX = /^[a-z0-9_.-]+$/;

const SENSITIVE_PATTERNS = [
  /-----BEGIN\s+(?:RSA|EC|OPENSSH|DSA)?\s*PRIVATE KEY-----/i,
  /\b(?:sk|ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_-]{18,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{22,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /\b(?:api[_-]?key|access[_-]?token|password|secret|authorization)\s*[:=]\s*["']?\S{8,}/i,
  /\bBearer\s+[A-Za-z0-9_.-]{20,}\b/i,
];

const INJECTION_PATTERNS = [
  /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|rules|commands)/i,
  /\b(?:system\s+prompt|developer\s+mode|jailbreak)\s*:/i,
  /<\s*(?:system|instruction|prompt)\s*>/i,
];

export function getJournalDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".contextforge", "agent-memory");
}

export function getEventsPath(workspaceRoot: string): string {
  return path.join(getJournalDir(workspaceRoot), "events.jsonl");
}

export function getLockPath(workspaceRoot: string): string {
  return path.join(getJournalDir(workspaceRoot), ".writer-lock");
}

export function canonicalJson(obj: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
}

export function computeDigest(obj: Record<string, unknown>): string {
  const jsonStr = canonicalJson(obj);
  return createHash("sha256").update(jsonStr, "utf8").digest("hex");
}

export function isPidAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err) {
      const code = (err as { code: string }).code;
      if (code === "EPERM") return true; // Process exists but we don't have permission to signal it
      if (code === "ESRCH") return false; // Process does not exist
    }
    return false;
  }
}

export function refuseSensitive(text: string): void {
  if (text.length > 4000) {
    throw new Error("One memory record exceeds 4000 characters; summarize it first");
  }
  if (!text.trim()) {
    throw new Error("Memory text cannot be empty");
  }
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      throw new Error("Memory text contains invalid control characters");
    }
  }
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error("Possible credential detected: redact before saving memory");
    }
  }
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error("Possible instruction injection detected in memory note");
    }
  }
}

async function verifyNotSymlink(targetPath: string, description: string): Promise<void> {
  if (await pathExists(targetPath)) {
    const stats = await lstat(targetPath);
    if (stats.isSymbolicLink()) {
      throw new Error(`${description} cannot be a symbolic link: ${targetPath}`);
    }
  }
}

export async function inspectLock(workspaceRoot: string): Promise<{
  isActive: boolean;
  message: string;
  pid: number | null;
}> {
  const lockPath = getLockPath(workspaceRoot);
  if (!(await pathExists(lockPath))) {
    return { isActive: false, message: "No lock", pid: null };
  }
  try {
    const content = await readFile(lockPath, "utf8");
    const meta = content.trim() ? JSON.parse(content) : {};
    const pid = typeof meta.pid === "number" ? meta.pid : null;
    const ts = typeof meta.timestamp === "number" ? meta.timestamp : 0;
    const now = Date.now() / 1000;
    const age = ts ? now - ts : LOCK_TIMEOUT_SECONDS + 1;

    if (pid !== null && !isPidAlive(pid)) {
      return {
        isActive: false,
        message: `Stale lock from dead process PID ${pid} (age ${Math.floor(age)}s)`,
        pid,
      };
    }
    if (age > LOCK_TIMEOUT_SECONDS) {
      return {
        isActive: false,
        message: `Stale lock timed out (age ${Math.floor(age)}s > ${LOCK_TIMEOUT_SECONDS}s)`,
        pid,
      };
    }
    return {
      isActive: true,
      message: `Active writer lock held by PID ${pid} (age ${Math.floor(age)}s)`,
      pid,
    };
  } catch (err: unknown) {
    return {
      isActive: false,
      message: `Unreadable lock file: ${err instanceof Error ? err.message : String(err)}`,
      pid: null,
    };
  }
}

export async function clearLock(workspaceRoot: string, force = false): Promise<boolean> {
  const lockPath = getLockPath(workspaceRoot);
  if (!(await pathExists(lockPath))) {
    return false;
  }
  const status = await inspectLock(workspaceRoot);
  if (status.isActive && !force) {
    throw new Error(
      `Cannot clear active writer lock held by PID ${status.pid}. Pass force=true if confirmed abandoned.`,
    );
  }
  await unlink(lockPath).catch(() => {});
  return true;
}

export async function readJournalEvents(workspaceRoot: string): Promise<JournalEvent[]> {
  const journalDir = getJournalDir(workspaceRoot);
  await verifyNotSymlink(journalDir, "Memory directory");

  const eventsPath = getEventsPath(workspaceRoot);
  if (!(await pathExists(eventsPath))) {
    return [];
  }
  await verifyNotSymlink(eventsPath, "Memory log");

  let content = await readFile(eventsPath, "utf8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = content.split(/\r?\n/);
  const events: JournalEvent[] = [];
  let previous = "0".repeat(64);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid JSON on log line ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (event.v !== VERSION) {
      throw new Error(`Unsupported record version on line ${i + 1}`);
    }

    const supplied = event.digest;
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(event)) {
      if (k !== "digest") {
        payload[k] = v;
      }
    }

    if (event.previous !== previous || supplied !== computeDigest(payload)) {
      throw new Error(`Log integrity mismatch on line ${i + 1}; do not continue writing`);
    }

    const parsed = JournalEventSchema.safeParse(event);
    if (!parsed.success) {
      throw new Error(`Invalid event fields on line ${i + 1}: ${parsed.error.message}`);
    }

    previous = supplied as string;
    events.push(parsed.data);
  }

  return events;
}

export type JournalEventInput = {
  kind: JournalEventKind;
  text: string;
  source?: string;
  tags?: string[];
  supersedes?: string;
  breakLock?: boolean;
};

// Exclusive-create lock with stale detection, shared by journal appends,
// Markdown mirror updates, and journal repair so that every read-modify-write
// sequence is serialized across the CLI, dashboard, and Python skill.
export async function acquireWriterLock(workspaceRoot: string, breakLock: boolean): Promise<void> {
  // The lock lives inside the journal directory; create it first so first
  // writers on a fresh workspace do not fail opening the lock file.
  await ensureDir(getJournalDir(workspaceRoot));
  const lockPath = getLockPath(workspaceRoot);
  await verifyNotSymlink(lockPath, "Writer lock");

  const lockPayload = JSON.stringify({
    pid: process.pid,
    created_at: new Date().toISOString(),
    timestamp: Date.now() / 1000,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(lockPayload, "utf8");
      await handle.close();
      return;
    } catch {
      const lockStatus = await inspectLock(workspaceRoot);
      if (breakLock || !lockStatus.isActive) {
        await unlink(lockPath).catch(() => {});
        continue;
      }
      throw new Error(`Memory writer lock exists (${lockStatus.message}). Check for an active writer before clearing it.`);
    }
  }
  throw new Error("Failed to acquire memory writer lock after recovery attempt");
}

export async function releaseWriterLock(workspaceRoot: string): Promise<void> {
  await unlink(getLockPath(workspaceRoot)).catch(() => {});
}

export async function appendJournalEvent(
  workspaceRoot: string,
  input: JournalEventInput,
): Promise<{ event: JournalEvent; created: boolean }> {
  refuseSensitive(input.text);
  const source = (input.source ?? "").trim();
  if (source) {
    for (let i = 0; i < source.length; i++) {
      const code = source.charCodeAt(i);
      if (code < 32 && code !== 9) {
        throw new Error("Source reference contains invalid control characters or newlines");
      }
    }
    refuseSensitive(source);
    if (source.length > 300) {
      throw new Error("Source reference too long");
    }
  }

  const supersedes = (input.supersedes ?? "").trim();
  if (supersedes && !VALID_ID_REGEX.test(supersedes)) {
    throw new Error("supersedes must be a 12-character hexadecimal record ID");
  }

  const tags = (input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (tags.length > 20 || tags.some((t) => t.length > 50)) {
    throw new Error("Too many or oversized tags");
  }
  for (const tag of tags) {
    if (!VALID_TAG_REGEX.test(tag)) {
      throw new Error(`Invalid tag format: '${tag}'. Tags must be alphanumeric with underscores, dots, or hyphens.`);
    }
  }

  const journalDir = getJournalDir(workspaceRoot);
  await ensureDir(journalDir);
  await verifyNotSymlink(journalDir, "Memory directory");

  const lockPath = getLockPath(workspaceRoot);
  await verifyNotSymlink(lockPath, "Writer lock");

  await acquireWriterLock(workspaceRoot, input.breakLock ?? false);

  try {
    const oldEvents = await readJournalEvents(workspaceRoot);
    if (supersedes && !oldEvents.some((e) => e.id === supersedes)) {
      throw new Error(`Cannot supersede a missing record: ${supersedes}`);
    }

    const cleanText = input.text.trim();
    const duplicate = oldEvents.find(
      (e) =>
        e.kind === input.kind &&
        e.text === cleanText &&
        e.source === source &&
        e.supersedes === supersedes,
    );
    if (duplicate) {
      return { event: duplicate, created: false };
    }

    const id = randomBytes(6).toString("hex");
    const payload: Omit<JournalEvent, "digest"> = {
      v: VERSION,
      id,
      created_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      kind: input.kind,
      text: cleanText,
      source,
      tags,
      supersedes,
      previous: oldEvents.length > 0 ? oldEvents[oldEvents.length - 1].digest : "0".repeat(64),
    };
    const digest = computeDigest(payload as Record<string, unknown>);
    const event: JournalEvent = { ...payload, digest };

    const eventsPath = getEventsPath(workspaceRoot);
    await verifyNotSymlink(eventsPath, "Memory log");
    const line = `${JSON.stringify(event)}\n`;
    await writeFile(eventsPath, line, { flag: "a", encoding: "utf8" });

    return { event, created: true };
  } finally {
    await unlink(lockPath).catch(() => {});
  }
}

export function getActiveEvents(events: JournalEvent[]): JournalEvent[] {
  const supersededIds = new Set(events.map((e) => e.supersedes).filter(Boolean));
  return events.filter((e) => !supersededIds.has(e.id));
}

export async function auditJournal(workspaceRoot: string): Promise<{
  totalRecords: number;
  activeRecords: number;
  supersededRecords: number;
  kinds: Record<string, number>;
  lockStatus: string;
  isValid: boolean;
}> {
  const events = await readJournalEvents(workspaceRoot);
  const active = getActiveEvents(events);
  const kinds: Record<string, number> = {};
  for (const e of events) {
    kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  }
  const lockInfo = await inspectLock(workspaceRoot);

  return {
    totalRecords: events.length,
    activeRecords: active.length,
    supersededRecords: events.length - active.length,
    kinds,
    lockStatus: lockInfo.message,
    isValid: true,
  };
}

export async function repairJournal(
  workspaceRoot: string,
  breakLock = false,
): Promise<{
  validRecords: number;
  corruptLines: number;
  backupPath: string | null;
}> {
  const journalDir = getJournalDir(workspaceRoot);
  await ensureDir(journalDir);
  await verifyNotSymlink(journalDir, "Memory directory");

  // Hold the same writer lock appendJournalEvent uses across the entire
  // read→rename→write sequence. Without it, an append committed between the
  // backup rename (when events.jsonl is absent and a writer would see an
  // empty journal) and the reconstruction write would be silently clobbered.
  await acquireWriterLock(workspaceRoot, breakLock);

  try {
    const eventsPath = getEventsPath(workspaceRoot);
    if (!(await pathExists(eventsPath))) {
      return { validRecords: 0, corruptLines: 0, backupPath: null };
    }

    let content = await readFile(eventsPath, "utf8");
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const lines = content.split(/\r?\n/);
    const validEvents: JournalEvent[] = [];
    let corruptCount = 0;
    let previous = "0".repeat(64);
    let hasCorruption = false;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw) continue;

      if (hasCorruption) {
        corruptCount++;
        continue;
      }

      try {
        const event = JSON.parse(raw);
        if (event.v !== VERSION) {
          hasCorruption = true;
          corruptCount++;
          continue;
        }
        const supplied = event.digest;
        const payload: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(event)) {
          if (k !== "digest") payload[k] = v;
        }
        if (event.previous !== previous || supplied !== computeDigest(payload)) {
          hasCorruption = true;
          corruptCount++;
          continue;
        }
        const parsed = JournalEventSchema.safeParse(event);
        if (!parsed.success) {
          hasCorruption = true;
          corruptCount++;
          continue;
        }
        previous = supplied as string;
        validEvents.push(parsed.data);
      } catch {
        hasCorruption = true;
        corruptCount++;
      }
    }

    let backupPath: string | null = null;
    if (hasCorruption) {
      const tsStr = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      backupPath = path.join(journalDir, `events.jsonl.bak.${tsStr}`);
      await rename(eventsPath, backupPath);

      const reconstructed = validEvents.map((e) => JSON.stringify(e)).join("\n") + (validEvents.length > 0 ? "\n" : "");
      // Atomic swap via a temp file so the journal is never absent or
      // half-written between the backup rename and the reconstruction.
      const tempPath = `${eventsPath}.repair-${process.pid}-${Date.now()}.tmp`;
      try {
        await writeFile(tempPath, reconstructed, "utf8");
        await rename(tempPath, eventsPath);
      } catch (error) {
        await unlink(tempPath).catch(() => {});
        throw error;
      }
    }

    return {
      validRecords: validEvents.length,
      corruptLines: corruptCount,
      backupPath,
    };
  } finally {
    await releaseWriterLock(workspaceRoot);
  }
}
