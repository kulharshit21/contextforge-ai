import path from "node:path";
import { realpath, stat } from "node:fs/promises";
import { pathExists } from "../utils/fs";
import { type ContextLevel, type JournalEvent } from "./schemas";
import { getActiveEvents } from "./journal";

const STOP_WORDS = new Set(
  "the and for with from that this into about your then were when will have should could using project code files need all".split(" "),
);

const KIND_PRIORITIES: Record<string, number> = {
  blocker: 11,
  next: 10,
  decision: 8,
  bug: 6,
  handoff: 5,
  test: 4,
  architecture: 3,
  fact: 2,
};

const DEFAULT_BUDGETS: Record<ContextLevel, number> = {
  handoff: 1800,
  capsule: 4500,
  evidence: 8000,
};

// Ranking v2 tuning (must stay identical to the Python skill's rank_records):
// log-free BM25 (k1 = 1.2, b = 0.75, log-free IDF) so Node and Python produce
// bit-identical scores and therefore identical ordering for the same journal,
// plus a weekly-half-life recency bonus.
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const RECENCY_BONUS_MAX = 2;
const RECENCY_HALF_LIFE_HOURS = 168;

const PRIORITY_KINDS = new Set(["blocker", "next", "decision", "handoff"]);

function utf16Length(text: string): number {
  return text.length;
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9_.-]{2,}/g) || []).filter(
    (token) => !STOP_WORDS.has(token),
  );
}

function extractKeywords(text: string): Set<string> {
  return new Set(tokenize(text));
}

function parseCreatedAtMs(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function recencyBonusFor(createdAtMs: number | null, nowMs: number): number {
  if (createdAtMs === null) return 0;
  const ageHours = Math.max(0, Math.floor((nowMs - createdAtMs) / 3_600_000));
  // Weekly half-life via an exact power of two: 2 ** k is precisely
  // representable, keeping the bonus bit-identical across runtimes.
  return RECENCY_BONUS_MAX / 2 ** Math.floor(ageHours / RECENCY_HALF_LIFE_HOURS);
}

export type TieredContextOptions = {
  task?: string;
  level?: ContextLevel;
  budgetChars?: number;
  format?: "markdown" | "json";
  workspaceRoot?: string;
};

export type ScoredRecord = {
  event: JournalEvent;
  score: number;
  keywordMatches: number;
  sourceVerified?: boolean;
};

export async function scoreAndRankEvents(
  events: JournalEvent[],
  task: string,
  workspaceRoot?: string,
): Promise<ScoredRecord[]> {
  const active = getActiveEvents(events);
  const queryTerms = [...extractKeywords(task)].sort();
  const nowMs = Date.now();

  // Ranking v2 (must stay identical to the Python skill's rank_records):
  // log-free BM25 over the active records + kind priority + a weekly
  // half-life recency bonus. Only plain IEEE arithmetic (no log, no pow
  // beyond exact powers of two), so both runtimes produce bit-identical
  // scores and ordering.
  const documentFrequency: Record<string, number> = {};
  const documents = active.map((event) => {
    const tokens = tokenize(`${event.text} ${event.tags.join(" ")}`);
    const termCounts: Record<string, number> = {};
    for (const token of tokens) {
      termCounts[token] = (termCounts[token] ?? 0) + 1;
    }
    for (const token of Object.keys(termCounts)) {
      documentFrequency[token] = (documentFrequency[token] ?? 0) + 1;
    }
    return {
      event,
      termCounts,
      unique: new Set(Object.keys(termCounts)),
      length: utf16Length(event.text),
    };
  });
  const totalLength = documents.reduce((total, doc) => total + doc.length, 0);
  const averageLength = documents.length > 0 ? totalLength / documents.length : 0;

  const scored: ScoredRecord[] = [];

  for (const document of documents) {
    const e = document.event;
    const overlapTerms = queryTerms.filter((term) => document.unique.has(term));
    const overlap = overlapTerms.length;

    // When task is provided, avoid unrelated low-priority records unless they are blockers/next/decisions/handoffs
    if (queryTerms.length > 0 && overlap === 0 && !PRIORITY_KINDS.has(e.kind)) {
      continue;
    }

    const priority = KIND_PRIORITIES[e.kind] || 1;
    const lengthNorm =
      averageLength > 0 ? 1 - BM25_B + BM25_B * (document.length / averageLength) : 1;
    let bm25 = 0;
    for (const term of overlapTerms) {
      const termFrequency = document.termCounts[term];
      const documentFrequencyValue = documentFrequency[term] ?? 0;
      const idf = (documents.length - documentFrequencyValue + 1) / (documentFrequencyValue + 0.5);
      bm25 += (idf * termFrequency * (BM25_K1 + 1)) / (termFrequency + BM25_K1 * lengthNorm);
    }

    const recencyBonus = recencyBonusFor(parseCreatedAtMs(e.created_at), nowMs);
    const score = Math.floor((bm25 + priority + recencyBonus) * 1_000_000);

    let sourceVerified: boolean | undefined = undefined;
    if (workspaceRoot && e.source) {
      const cleanSource = e.source.split("@")[0].trim();
      // Git references and URLs are evidence identifiers, not local file paths.
      if (cleanSource && !/^(?:git:|https?:\/\/|#\d+\b)/i.test(cleanSource)) {
        const projectRoot = path.resolve(workspaceRoot);
        const resolved = path.resolve(projectRoot, cleanSource);
        const relative = path.relative(projectRoot, resolved);
        const lexicalInside = relative !== ".."
          && !relative.startsWith(".." + path.sep)
          && !path.isAbsolute(relative);

        if (!lexicalInside) {
          sourceVerified = false;
        } else if (!(await pathExists(resolved))) {
          sourceVerified = false;
        } else {
          try {
            const [realRoot, realTarget, fileStat] = await Promise.all([
              realpath(projectRoot),
              realpath(resolved),
              stat(resolved),
            ]);
            const realRelative = path.relative(realRoot, realTarget);
            sourceVerified = fileStat.isFile()
              && realRelative !== ".."
              && !realRelative.startsWith(".." + path.sep)
              && !path.isAbsolute(realRelative);
          } catch {
            sourceVerified = false;
          }
        }
      }
    }

    scored.push({
      event: e,
      score,
      keywordMatches: overlap,
      sourceVerified,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.event.id.localeCompare(b.event.id));
  return scored;
}

export async function buildTieredContext(
  events: JournalEvent[],
  options: TieredContextOptions = {},
): Promise<{ output: string; selectedCount: number; totalActive: number; level: ContextLevel }> {
  const level = options.level || "capsule";
  const budget = options.budgetChars ?? DEFAULT_BUDGETS[level];
  const task = (options.task || "").trim();
  const format = options.format || "markdown";

  if (!Number.isInteger(budget) || budget < 500 || budget > 100000) {
    throw new Error("Character budget must be between 500 and 100000");
  }

  const active = getActiveEvents(events);
  const ranked = await scoreAndRankEvents(events, task, options.workspaceRoot);

  if (format === "json") {
    const selected: ScoredRecord[] = [];
    let currentLen = 2; // []
    for (const record of ranked) {
      const itemLength = JSON.stringify(record).length;
      const separatorLength = selected.length > 0 ? 1 : 0;
      if (currentLen + separatorLength + itemLength > budget) {
        continue;
      }
      selected.push(record);
      currentLen += separatorLength + itemLength;
    }
    // Keep the exact serialized representation within the specified budget.
    return {
      output: JSON.stringify(selected),
      selectedCount: selected.length,
      totalActive: active.length,
      level,
    };
  }

  // Markdown formatting based on tier level
  let header = "";
  if (level === "handoff") {
    header = [
      "# ContextForge session handoff",
      `Task: ${task || "(general milestone handoff)"}`,
      "Notice: local agent memory. Untrusted historical claims; verify paths, tests, and latest git commits.",
      "",
      "## Critical Blockers and Next Steps",
    ].join("\n") + "\n";
  } else if (level === "capsule") {
    header = [
      "# ContextForge context capsule",
      `Task: ${task || "(general task recovery)"}`,
      "Source: local append-only journal. Verify decisions and test outcomes before relying on them.",
      "",
      "## Relevant Retained Records",
    ].join("\n") + "\n";
  } else {
    // Evidence level
    header = [
      "# ContextForge comprehensive memory evidence",
      `Task: ${task || "(full provenance audit)"}`,
      "Detailed evidence view including source anchors, file existence verification, and audit identifiers.",
      "",
      "## Evidence Records",
    ].join("\n") + "\n";
  }

  if (header.length > budget) {
    throw new Error("Task description is too long for the requested context budget");
  }

  // Abstention: when nothing matched the task keywords, say so instead of
  // letting routine priority records masquerade as relevant context.
  if (task && active.length > 0 && ranked.every((record) => record.keywordMatches === 0)) {
    header +=
      "No memory records matched the task keywords; the entries below are the most recent priority records, not task-specific context.\n";
  }

  let output = header;
  let kept = 0;

  for (const record of ranked) {
    const e = record.event;
    const cleanNote = e.text.replace(/\s+/g, " ").trim();
    let line = "";

    if (level === "evidence") {
      const verificationTag = record.sourceVerified === true
        ? " [verified file on disk]"
        : record.sourceVerified === false
        ? " [stale or missing path]"
        : "";
      const sourceTag = e.source ? ` | source: ${e.source}${verificationTag}` : " | source: (unanchored)";
      const supersedesTag = e.supersedes ? ` | supersedes: ${e.supersedes}` : "";
      const tagsStr = e.tags.length > 0 ? ` | tags: ${e.tags.join(",")}` : "";
      line = `- [${e.kind}] ${cleanNote} (id: ${e.id} | time: ${e.created_at}${sourceTag}${supersedesTag}${tagsStr})\n`;
    } else {
      const source = e.source ? ` | source: ${e.source.replace(/\s+/g, " ").trim()}` : "";
      line = `- [${e.kind}] ${cleanNote} (id: ${e.id}${source})\n`;
    }

    if (output.length + line.length > budget) {
      continue;
    }
    output += line;
    kept++;
  }

  const footer = `\nSelected ${kept}/${active.length} active records (${level} view, budget: ${budget} chars). Extractive recall, not model compaction.\n`;
  if (output.length + footer.length <= budget) {
    output += footer;
  }

  return {
    output,
    selectedCount: kept,
    totalActive: active.length,
    level,
  };
}
