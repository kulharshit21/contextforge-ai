import { randomUUID } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { simpleGit } from "simple-git";

import { isoNow } from "../utils/date";
import {
  ensureDir,
  pathExists,
  readJsonIfExists,
  readTextIfExists,
  writeJsonPretty,
} from "../utils/fs";
import { slugify } from "../utils/slug";

import {
  acquireWriterLock,
  appendJournalEvent,
  auditJournal,
  readJournalEvents,
  releaseWriterLock,
  repairJournal,
} from "./journal";
import { parseMemoryFile, renderMemoryFile } from "./markdown";
import {
  CapsuleSchema,
  JOURNAL_EVENT_KINDS,
  MEMORY_FILE_KEYS,
  MemoryFileKeySchema,
  RepoScanSchema,
  type Capsule,
  type ExtractedMemory,
  type JournalEvent,
  type JournalEventKind,
  type MemoryFile,
  type MemoryFileKey,
  type MemoryItem,
} from "./schemas";
import { buildTieredContext, type TieredContextOptions } from "./tiered-context";

type MemoryFileDefinition = {
  key: MemoryFileKey;
  filename: `${MemoryFileKey}.md`;
  title: string;
  purpose: string;
  starterSummary: string;
};

export const MEMORY_FILE_DEFINITIONS: MemoryFileDefinition[] = [
  {
    key: "PROJECT_STATE",
    filename: "PROJECT_STATE.md",
    title: "Project State",
    purpose:
      "Track what is currently built, what works, what is incomplete, the stack in use, and present limitations.",
    starterSummary:
      "Capture the current shape of the product so future AI sessions do not waste tokens rediscovering what already exists.",
  },
  {
    key: "ARCHITECTURE",
    filename: "ARCHITECTURE.md",
    title: "Architecture",
    purpose:
      "Record system architecture, folder structure, data flow, auth flow, API flow, and storage flow.",
    starterSummary:
      "Keep architecture durable and high-signal so agents can navigate the repo without guessing.",
  },
  {
    key: "FEATURES",
    filename: "FEATURES.md",
    title: "Features",
    purpose:
      "List completed, in-progress, and planned features with durable status notes.",
    starterSummary:
      "Use this file to separate finished work from rough ideas and planned work.",
  },
  {
    key: "DECISIONS",
    filename: "DECISIONS.md",
    title: "Decisions",
    purpose:
      "Capture decisions, why they were made, alternatives rejected, dates, and downstream impact.",
    starterSummary:
      "Write down the why, not just the what, so future sessions do not reopen settled choices.",
  },
  {
    key: "BUGS_AND_FIXES",
    filename: "BUGS_AND_FIXES.md",
    title: "Bugs And Fixes",
    purpose:
      "Store recurring bugs, causes, fixes, files involved, and how to avoid repeating them.",
    starterSummary:
      "Every repeated bug is a sign the memory needs to be stronger and more precise.",
  },
  {
    key: "FAILED_ATTEMPTS",
    filename: "FAILED_ATTEMPTS.md",
    title: "Failed Attempts",
    purpose:
      "Log what was tried, why it failed, the errors involved, and the lesson learned.",
    starterSummary:
      "Treat failed paths as durable memory so agents do not burn tokens retrying them.",
  },
  {
    key: "API_CONTRACTS",
    filename: "API_CONTRACTS.md",
    title: "API Contracts",
    purpose:
      "Track endpoints, payloads, responses, DB tables, and auth requirements.",
    starterSummary:
      "Keep API memory exact because these details break quickly when they drift.",
  },
  {
    key: "ENV_AND_SETUP",
    filename: "ENV_AND_SETUP.md",
    title: "Env And Setup",
    purpose:
      "Track install commands, dev commands, test commands, required env vars, and common setup issues.",
    starterSummary:
      "This file should get a new contributor from clone to running app with minimal friction.",
  },
  {
    key: "CODING_RULES",
    filename: "CODING_RULES.md",
    title: "Coding Rules",
    purpose:
      "Store style rules, naming conventions, do/don't guidance, and framework-specific constraints.",
    starterSummary:
      "Keep this terse, opinionated, and practical so agents follow the repo's working habits.",
  },
  {
    key: "CURRENT_TASKS",
    filename: "CURRENT_TASKS.md",
    title: "Current Tasks",
    purpose:
      "Track active work, next steps, blockers, and reminders that the next AI session must see immediately.",
    starterSummary:
      "This file is the handoff lane between sessions and should stay current.",
  },
];

const SECTION_TO_FILE_KEY: Record<keyof ExtractedMemory, MemoryFileKey> = {
  project_state: "PROJECT_STATE",
  architecture: "ARCHITECTURE",
  features: "FEATURES",
  decisions: "DECISIONS",
  bugs_and_fixes: "BUGS_AND_FIXES",
  failed_attempts: "FAILED_ATTEMPTS",
  api_contracts: "API_CONTRACTS",
  env_and_setup: "ENV_AND_SETUP",
  coding_rules: "CODING_RULES",
  current_tasks: "CURRENT_TASKS",
};

export const KIND_TO_FILE_KEY: Record<JournalEventKind, MemoryFileKey> = {
  decision: "DECISIONS",
  bug: "BUGS_AND_FIXES",
  blocker: "CURRENT_TASKS",
  next: "CURRENT_TASKS",
  handoff: "CURRENT_TASKS",
  architecture: "ARCHITECTURE",
  fact: "PROJECT_STATE",
  test: "PROJECT_STATE",
};

export const FILE_KEY_TO_KIND: Record<MemoryFileKey, JournalEventKind> = {
  DECISIONS: "decision",
  BUGS_AND_FIXES: "bug",
  FAILED_ATTEMPTS: "bug",
  CURRENT_TASKS: "next",
  ARCHITECTURE: "architecture",
  PROJECT_STATE: "fact",
  FEATURES: "fact",
  API_CONTRACTS: "architecture",
  ENV_AND_SETUP: "fact",
  CODING_RULES: "fact",
};

export function getContextForgeDir(workspaceRoot: string) {
  return path.join(workspaceRoot, ".contextforge");
}

export function getCapsulesDir(workspaceRoot: string) {
  return path.join(getContextForgeDir(workspaceRoot), "CAPSULES");
}

export function getExportsDir(workspaceRoot: string) {
  return path.join(getContextForgeDir(workspaceRoot), "EXPORTS");
}

export function getConfigPath(workspaceRoot: string) {
  return path.join(getContextForgeDir(workspaceRoot), "contextforge.config.json");
}

export function getRepoScanPath(workspaceRoot: string) {
  return path.join(getContextForgeDir(workspaceRoot), "repo-scan.json");
}

export function getMemoryFilePath(workspaceRoot: string, fileKey: MemoryFileKey) {
  return path.join(getContextForgeDir(workspaceRoot), `${fileKey}.md`);
}

function createEmptyMemoryFile(definition: MemoryFileDefinition): MemoryFile {
  return {
    file_key: definition.key,
    title: definition.title,
    purpose: definition.purpose,
    summary: definition.starterSummary,
    version: 1,
    updated_at: isoNow(),
    items: [],
  };
}

function buildIndexMarkdown(projectName: string) {
  return [
    "# ContextForge Index",
    "",
    `Project: **${projectName}**`,
    "",
    "## Memory Files",
    "",
    ...MEMORY_FILE_DEFINITIONS.map(
      (definition) =>
        `- \`${definition.filename}\`: ${definition.purpose}`,
    ),
    "",
    "## Commands",
    "",
    "- `contextforge checkpoint \"...\"` to save a verified memory record.",
    "- `contextforge recall [task]` to restore tiered context.",
    "- `contextforge remember \"...\"` to append durable memory.",
    "- `contextforge scan` to refresh repo scan facts.",
    "- `contextforge capsule \"task\"` to generate a task-specific capsule.",
    "- `contextforge doctor` to detect memory drift.",
    "- `contextforge audit` to verify log integrity.",
    "- `contextforge repair` to recover from crashed writes.",
    "- `contextforge sync` to harmonize journal with Markdown memory.",
  ].join("\n");
}

async function maybeWriteContextForgeIgnore(workspaceRoot: string) {
  const ignorePath = path.join(workspaceRoot, ".contextforgeignore");
  if (await pathExists(ignorePath)) {
    return;
  }

  await writeFile(
    ignorePath,
    [
      "# Add extra ignore rules for ContextForge repo scanning here.",
      "coverage",
      "*.log",
    ].join("\n"),
    "utf8",
  );
}

function buildDefaultRepoScan(workspaceRoot: string) {
  return RepoScanSchema.parse({
    workspace_root: workspaceRoot,
    framework: "unknown",
    package_manager: "npm",
    scripts: {},
    app_routes: [],
    api_routes: [],
    library_files: [],
    database_migrations: [],
    env_examples: [],
    test_files: [],
    readme_summary: "",
    branch: "unknown",
    commit_hash: "unknown",
    recent_commits: [],
    files_inspected: [],
    warnings: [],
    totals: {
      file_count: 0,
      bytes_read: 0,
    },
    scanned_at: isoNow(),
  });
}

export async function initWorkspace(
  workspaceRoot: string,
  projectName = path.basename(workspaceRoot),
) {
  const contextforgeDir = getContextForgeDir(workspaceRoot);
  await ensureDir(contextforgeDir);
  await ensureDir(getCapsulesDir(workspaceRoot));
  await ensureDir(getExportsDir(workspaceRoot));

  for (const definition of MEMORY_FILE_DEFINITIONS) {
    const filePath = getMemoryFilePath(workspaceRoot, definition.key);
    if (!(await pathExists(filePath))) {
      await writeFile(
        filePath,
        renderMemoryFile(createEmptyMemoryFile(definition)),
        "utf8",
      );
    }
  }

  const indexPath = path.join(contextforgeDir, "INDEX.md");
  if (!(await pathExists(indexPath))) {
    await writeFile(indexPath, buildIndexMarkdown(projectName), "utf8");
  }

  if (!(await pathExists(getConfigPath(workspaceRoot)))) {
    await writeJsonPretty(getConfigPath(workspaceRoot), {
      projectName,
      createdAt: isoNow(),
      privacyMode: "local",
      provider: "mock",
      maxTokenBudget: 6000,
      memoryUpdateBehavior: "preview_first",
    });
  }

  if (!(await pathExists(getRepoScanPath(workspaceRoot)))) {
    await writeJsonPretty(
      getRepoScanPath(workspaceRoot),
      buildDefaultRepoScan(workspaceRoot),
    );
  }

  await maybeWriteContextForgeIgnore(workspaceRoot);
}

export async function loadMemoryFiles(workspaceRoot: string) {
  await initWorkspace(workspaceRoot);

  const files = await Promise.all(
    MEMORY_FILE_DEFINITIONS.map(async (definition) => {
      const raw = await readFile(
        getMemoryFilePath(workspaceRoot, definition.key),
        "utf8",
      );
      return parseMemoryFile(raw);
    }),
  );

  return files;
}

export async function loadMemoryFile(
  workspaceRoot: string,
  fileKey: MemoryFileKey,
) {
  MemoryFileKeySchema.parse(fileKey);
  await initWorkspace(workspaceRoot);

  const raw = await readFile(getMemoryFilePath(workspaceRoot, fileKey), "utf8");
  return parseMemoryFile(raw);
}

function assertValidMemoryFileKey(fileKey: unknown): asserts fileKey is MemoryFileKey {
  if (!MemoryFileKeySchema.safeParse(fileKey).success) {
    throw new Error(
      `Invalid memory file key: '${String(fileKey)}'. Must be one of: ${MEMORY_FILE_KEYS.join(", ")}`,
    );
  }
}

export async function saveMemoryFile(workspaceRoot: string, file: MemoryFile) {
  // Unknown keys must never reach path construction: a raw key such as
  // "../../evil" would otherwise escape the .contextforge directory.
  assertValidMemoryFileKey(file.file_key);
  const nextFile: MemoryFile = {
    ...file,
    updated_at: isoNow(),
  };

  await writeFile(
    getMemoryFilePath(workspaceRoot, nextFile.file_key),
    renderMemoryFile(nextFile),
    "utf8",
  );

  return nextFile;
}

export async function saveMemoryFileRaw(
  workspaceRoot: string,
  fileKey: MemoryFileKey,
  raw: string,
) {
  // Validate before parsing so callers get a precise error instead of a
  // content-parse failure, and before any path is derived from the key.
  assertValidMemoryFileKey(fileKey);
  const parsed = parseMemoryFile(raw);
  if (parsed.file_key !== fileKey) {
    parsed.file_key = fileKey;
  }

  await saveMemoryFile(workspaceRoot, parsed);
  return parsed;
}

function buildItemTitle(text: string) {
  const firstSentence = text.split(/[\r\n.!?]/).find(Boolean)?.trim() ?? text;
  return firstSentence.slice(0, 72);
}

export function inferKindFromText(text: string): JournalEventKind {
  const lowered = text.toLowerCase();
  if (/\b(blocker|blocked|cannot proceed)\b/.test(lowered)) return "blocker";
  if (/\b(next step|next action|todo|will do)\b/.test(lowered)) return "next";
  if (/\b(test|passed|verified ci|regression test)\b/.test(lowered)) return "test";
  if (/\b(bug|error|fix|failure|exception)\b/.test(lowered)) return "bug";
  if (/\b(decision|decided|tradeoff|chosen)\b/.test(lowered)) return "decision";
  if (/\b(architecture|component|interface|database flow)\b/.test(lowered)) return "architecture";
  if (/\b(handoff|milestone|session end)\b/.test(lowered)) return "handoff";
  return "fact";
}

export function inferFileKeyFromText(text: string): MemoryFileKey {
  const lowered = text.toLowerCase();

  if (/(bug|error|fix|redirect loop|failed request|exception)/.test(lowered)) {
    return "BUGS_AND_FIXES";
  }

  if (/(failed attempt|tried|did not work|doesn't work|didn't work)/.test(lowered)) {
    return "FAILED_ATTEMPTS";
  }

  if (/(rls|style rule|naming convention|do not|don't|must not|must)/.test(lowered)) {
    return "CODING_RULES";
  }

  // A deliberate decision stays a decision even when it mentions an API.
  if (/\b(decision|decided|tradeoff|alternative)\b/.test(lowered)) {
    return "DECISIONS";
  }

  if (/\b(route|endpoint|payload|response|table|schema|api|apis)\b/.test(lowered)) {
    return "API_CONTRACTS";
  }

  if (/(npm|pnpm|yarn|bun|env|install|setup|supabase|ollama|gemini)/.test(lowered)) {
    return "ENV_AND_SETUP";
  }

  if (/(task|next step|blocker|todo|currently|active)/.test(lowered)) {
    return "CURRENT_TASKS";
  }

  if (/(architecture|folder|data flow|auth flow|storage flow|system)/.test(lowered)) {
    return "ARCHITECTURE";
  }

  if (/(feature|invoice|module|implemented|completed|planned)/.test(lowered)) {
    return "FEATURES";
  }

  return "PROJECT_STATE";
}

export async function appendMemoryItem(
  workspaceRoot: string,
  fileKey: MemoryFileKey,
  itemInput: Omit<MemoryItem, "id" | "created_at" | "updated_at">,
) {
  const item: MemoryItem = {
    id: randomUUID(),
    created_at: isoNow(),
    updated_at: isoNow(),
    ...itemInput,
  };

  // The Markdown mirror is a full-file read-modify-write; hold the writer
  // lock around it so concurrent writers (CLI + dashboard + skill) cannot
  // overwrite each other's entries.
  await acquireWriterLock(workspaceRoot, false);
  try {
    const file = await loadMemoryFile(workspaceRoot, fileKey);
    const timestamp = isoNow();

    const nextFile: MemoryFile = {
      ...file,
      summary: updateSummary(file.summary, item),
      items: [item, ...file.items].slice(0, 50),
      version: file.version + 1,
      updated_at: timestamp,
    };

    await saveMemoryFile(workspaceRoot, nextFile);
  } finally {
    await releaseWriterLock(workspaceRoot);
  }

  return item;
}

function updateSummary(previousSummary: string, item: MemoryItem) {
  const snippet = `${item.title}: ${item.content}`.slice(0, 220);
  const nextSummary = previousSummary.trim();

  if (!nextSummary) {
    return snippet;
  }

  if (nextSummary.includes(item.title)) {
    return nextSummary;
  }

  return `${snippet}\n\n${nextSummary}`.slice(0, 1200);
}

export type CheckpointInput = {
  text: string;
  kind?: JournalEventKind;
  source?: string;
  tags?: string[];
  supersedes?: string;
  noSync?: boolean;
  breakLock?: boolean;
};

export async function checkpointMemory(
  workspaceRoot: string,
  input: CheckpointInput,
): Promise<{ event: JournalEvent; item: MemoryItem | null; fileKey: MemoryFileKey; created: boolean }> {
  await initWorkspace(workspaceRoot);
  let fileKey: MemoryFileKey;
  let kind: JournalEventKind;
  if (input.kind) {
    kind = input.kind;
    fileKey = KIND_TO_FILE_KEY[kind] || inferFileKeyFromText(input.text);
  } else {
    fileKey = inferFileKeyFromText(input.text);
    kind = FILE_KEY_TO_KIND[fileKey] || inferKindFromText(input.text);
  }
  let source = input.source?.trim() || "";

  if (!source) {
    try {
      const git = simpleGit(workspaceRoot);
      const commit = await git.revparse(["--short", "HEAD"]);
      if (commit && commit !== "HEAD") {
        source = `git:${commit}`;
      }
    } catch {
      // not a git repository or git missing; continue without git anchor
    }
  }

  const { event, created } = await appendJournalEvent(workspaceRoot, {
    kind,
    text: input.text,
    source,
    tags: input.tags,
    supersedes: input.supersedes,
    breakLock: input.breakLock,
  });

  let item: MemoryItem | null = null;
  if (!input.noSync) {
    // A duplicate journal event must not create another copy in Markdown.
    // However, a journal-only Python checkpoint should still be mirrored
    // when the same note is checkpointed through the Node CLI.
    const memoryFile = await loadMemoryFile(workspaceRoot, fileKey);
    const isMirrored = memoryFile.items.some(
      (existing) =>
        existing.type === kind && existing.content.trim() === event.text.trim(),
    );
    if (!isMirrored) {
      item = await appendMemoryItem(workspaceRoot, fileKey, {
        type: kind,
        title: buildItemTitle(input.text),
        content: input.text,
        source: source || "cli:checkpoint",
        confidence: 0.9,
        related_files: source.startsWith("git:") ? [] : (source ? [source] : []),
        tags: input.tags || [kind],
      });
    }
  }

  return { event, item, fileKey, created };
}

export async function remember(workspaceRoot: string, text: string) {
  const result = await checkpointMemory(workspaceRoot, { text });
  if (result.item) {
    return result.item;
  }
  const fileKey = inferFileKeyFromText(text);
  return {
    id: result.event.id,
    type: fileKey.toLowerCase(),
    title: buildItemTitle(text),
    content: text,
    source: "cli:remember",
    confidence: 0.86,
    created_at: result.event.created_at,
    updated_at: result.event.created_at,
    related_files: [],
    tags: ["remember"],
  };
}

export async function recallContext(
  workspaceRoot: string,
  options: TieredContextOptions = {},
) {
  await initWorkspace(workspaceRoot);
  const events = await readJournalEvents(workspaceRoot);
  return buildTieredContext(events, { ...options, workspaceRoot });
}

export async function auditAllMemory(workspaceRoot: string) {
  await initWorkspace(workspaceRoot);
  const journal = await auditJournal(workspaceRoot);
  const memoryFiles = await loadMemoryFiles(workspaceRoot);
  const markdownSummary: Record<string, number> = {};
  for (const f of memoryFiles) {
    markdownSummary[f.file_key] = f.items.length;
  }
  return {
    journal,
    markdown: {
      fileCount: memoryFiles.length,
      items: markdownSummary,
    },
  };
}

export async function repairAllMemory(
  workspaceRoot: string,
  breakLock = false,
) {
  await initWorkspace(workspaceRoot);
  return repairJournal(workspaceRoot, breakLock);
}

export async function syncMemory(workspaceRoot: string): Promise<{
  importedToJournal: number;
}> {
  await initWorkspace(workspaceRoot);
  const memoryFiles = await loadMemoryFiles(workspaceRoot);
  const journalEvents = await readJournalEvents(workspaceRoot);
  const knownTexts = new Set(journalEvents.map((e) => e.text.trim()));

  let importedToJournal = 0;
  for (const file of memoryFiles) {
    const defaultKind = FILE_KEY_TO_KIND[file.file_key] || "fact";
    for (const item of file.items) {
      const text = item.content.trim();
      // The known-text set is refreshed with every append so the same content
      // appearing in multiple memory files is imported exactly once and the
      // reported count matches the events actually created.
      if (!text || knownTexts.has(text)) {
        continue;
      }
      try {
        const kind = (JOURNAL_EVENT_KINDS.includes(item.type as JournalEventKind)
          ? (item.type as JournalEventKind)
          : defaultKind);
        const { created } = await appendJournalEvent(workspaceRoot, {
          kind,
          text: item.content,
          source: item.source || `${file.file_key}.md`,
          tags: item.tags,
        });
        knownTexts.add(text);
        if (created) {
          importedToJournal++;
        }
      } catch {
        // ignore invalid or sensitive item imports
      }
    }
  }

  return { importedToJournal };
}

export async function mergeExtractedMemory(
  workspaceRoot: string,
  extracted: ExtractedMemory,
  source = "chat-ingest",
) {
  const createdItems: MemoryItem[] = [];

  for (const [section, entries] of Object.entries(extracted) as Array<
    [keyof ExtractedMemory, ExtractedMemory[keyof ExtractedMemory]]
  >) {
    const fileKey = SECTION_TO_FILE_KEY[section];

    for (const entry of entries) {
      // Journal each entry as well: recall reads only the journal, and the
      // Markdown mirror caps its items at 50 per file. Without a journal
      // record, ingested memories are invisible to recall and can be lost
      // permanently once they age out of the mirror.
      const kind = FILE_KEY_TO_KIND[fileKey] || "fact";
      await appendJournalEvent(workspaceRoot, {
        kind,
        text: entry.content,
        source: entry.source || source,
        tags: entry.tags,
      });
      const item = await appendMemoryItem(workspaceRoot, fileKey, {
        type: section,
        title: entry.title,
        content: entry.content,
        source: entry.source || source,
        confidence: entry.confidence,
        related_files: entry.related_files,
        tags: entry.tags,
      });
      createdItems.push(item);
    }
  }

  return createdItems;
}

export async function readRepoScan(workspaceRoot: string) {
  await initWorkspace(workspaceRoot);
  const scan =
    (await readJsonIfExists<unknown>(getRepoScanPath(workspaceRoot))) ??
    buildDefaultRepoScan(workspaceRoot);
  return RepoScanSchema.parse(scan);
}

export async function writeRepoScan(workspaceRoot: string, scan: unknown) {
  const parsed = RepoScanSchema.parse(scan);
  await writeJsonPretty(getRepoScanPath(workspaceRoot), parsed);
  return parsed;
}

export async function saveCapsule(
  workspaceRoot: string,
  task: string,
  capsule: Capsule,
) {
  const parsed = CapsuleSchema.parse(capsule);
  const timestamp = new Date();
  const datePrefix = timestamp.toISOString().slice(0, 10);
  const slug = slugify(task);
  const filePath = path.join(getCapsulesDir(workspaceRoot), `${datePrefix}-${slug}-${randomUUID().slice(0, 8)}.md`);
  const markdown = matter.stringify(
    [
      `# Capsule: ${task}`,
      "",
      `## Goal`,
      "",
      parsed.goal,
      "",
      `## Summary`,
      "",
      parsed.summary,
      "",
      `## Relevant Context`,
      "",
      ...parsed.relevant_context.map((line) => `- ${line}`),
      "",
      `## Files Likely Needed`,
      "",
      ...parsed.files_likely_needed.map((line) => `- \`${line}\``),
      "",
      `## Files To Avoid`,
      "",
      ...parsed.files_to_avoid.map((line) => `- \`${line}\``),
      "",
      `## Previous Errors To Remember`,
      "",
      ...parsed.previous_errors_to_remember.map((line) => `- ${line}`),
      "",
      `## Commands To Run`,
      "",
      ...parsed.commands_to_run.map((line) => `- \`${line}\``),
      "",
      `## Agent Prompt`,
      "",
      "```md",
      parsed.agent_prompt,
      "```",
    ].join("\n"),
    {
      task,
      created_at: timestamp.toISOString(),
      estimated_raw_tokens: parsed.estimated_raw_tokens,
      estimated_capsule_tokens: parsed.estimated_capsule_tokens,
      saved_percent: parsed.saved_percent,
    },
  );

  await writeFile(filePath, markdown, "utf8");
  return { filePath, markdown };
}

export async function listSavedCapsules(workspaceRoot: string) {
  await initWorkspace(workspaceRoot);
  const capsuleDir = getCapsulesDir(workspaceRoot);
  const entries = await readdir(capsuleDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md"));

  const capsules = (
    await Promise.all(
      files.map(async (entry) => {
        const filePath = path.join(capsuleDir, entry.name);
        try {
          const raw = await readFile(filePath, "utf8");
          const parsed = matter(raw);
          return {
            id: entry.name,
            fileName: entry.name,
            task: String(parsed.data.task ?? entry.name),
            createdAt: String(parsed.data.created_at ?? ""),
            markdown: raw,
            estimatedRawTokens: Number(parsed.data.estimated_raw_tokens ?? 0),
            estimatedCapsuleTokens: Number(parsed.data.estimated_capsule_tokens ?? 0),
            savedPercent: Number(parsed.data.saved_percent ?? 0),
          };
        } catch (error) {
          // One malformed capsule (hand-edited frontmatter, torn write) must
          // not fail the whole project snapshot; skip it and keep the rest.
          console.warn(`Skipping unreadable capsule file: ${entry.name}`, error);
          return null;
        }
      }),
    )
  ).filter((capsule): capsule is NonNullable<typeof capsule> => capsule !== null);

  return capsules.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveExport(
  workspaceRoot: string,
  target: string,
  content: string,
) {
  const safeTarget = target.replace(/[\\/]/g, "__");
  const filePath = path.join(getExportsDir(workspaceRoot), safeTarget);
  await writeFile(filePath, content, "utf8");
  return filePath;
}

export async function listSavedExports(workspaceRoot: string) {
  await initWorkspace(workspaceRoot);
  const exportDir = getExportsDir(workspaceRoot);
  const entries = await readdir(exportDir, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = path.join(exportDir, entry.name);
        return {
          id: entry.name,
          fileName: entry.name,
          content: (await readTextIfExists(filePath)) ?? "",
        };
      }),
  );
}
