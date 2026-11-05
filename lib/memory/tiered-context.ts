import path from "node:path";
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

function extractKeywords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9][a-z0-9_.-]{2,}/g) || [];
  return new Set(words.filter((w) => !STOP_WORDS.has(w)));
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
  const needles = extractKeywords(task);
  const scored: ScoredRecord[] = [];

  for (let i = 0; i < active.length; i++) {
    const e = active[i];
    const haystack = extractKeywords(`${e.text} ${e.tags.join(" ")} ${e.kind}`);
    let overlap = 0;
    for (const needle of needles) {
      if (haystack.has(needle)) overlap++;
    }

    // When task is provided, avoid unrelated low-priority records unless they are blockers/next/decisions/handoffs
    if (needles.size > 0 && overlap === 0 && !["blocker", "next", "decision", "handoff"].includes(e.kind)) {
      continue;
    }

    const priority = KIND_PRIORITIES[e.kind] || 1;
    const recency = (i + 1) / Math.max(1, active.length);
    const score = overlap * 16 + priority + recency * 4;

    let sourceVerified: boolean | undefined = undefined;
    if (workspaceRoot && e.source) {
      const cleanSource = e.source.split("@")[0].trim();
      const resolved = path.resolve(workspaceRoot, cleanSource);
      if (resolved.startsWith(path.resolve(workspaceRoot))) {
        sourceVerified = await pathExists(resolved);
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
  const budget = options.budgetChars || DEFAULT_BUDGETS[level];
  const task = (options.task || "").trim();
  const format = options.format || "markdown";

  if (budget < 500 || budget > 100000) {
    throw new Error("Character budget must be between 500 and 100000");
  }

  const active = getActiveEvents(events);
  const ranked = await scoreAndRankEvents(events, task, options.workspaceRoot);

  if (format === "json") {
    const selected: ScoredRecord[] = [];
    let currentLen = 2; // "[]"
    for (const record of ranked) {
      const itemJson = JSON.stringify(record);
      if (currentLen + itemJson.length + 1 > budget) break;
      selected.push(record);
      currentLen += itemJson.length + 1;
    }
    return {
      output: JSON.stringify(selected, null, 2),
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
