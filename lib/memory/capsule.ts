import { estimateSavings } from "@/lib/utils/tokens";

import type { Capsule, MemoryFile, MemoryItem, RepoScan } from "./schemas";

function tokenizeTask(task: string) {
  return task
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function scoreItem(taskTokens: string[], item: MemoryItem) {
  const haystack = `${item.title} ${item.content} ${item.related_files.join(" ")} ${item.tags.join(" ")}`.toLowerCase();
  let score = 0;

  for (const token of taskTokens) {
    if (haystack.includes(token)) {
      score += 3;
    }
  }

  if (item.type.includes("current") || item.type.includes("decision")) {
    score += 1;
  }

  return score;
}

function getRelevantItems(task: string, memoryFiles: MemoryFile[]) {
  const taskTokens = tokenizeTask(task);
  const items = memoryFiles.flatMap((file) => file.items);

  const scored = items
    .map((item) => ({
      item,
      score: scoreItem(taskTokens, item),
    }))
    .sort((a, b) => b.score - a.score || b.item.updated_at.localeCompare(a.item.updated_at));

  const strongest = scored.filter((entry) => entry.score > 0).slice(0, 8).map((entry) => entry.item);
  if (strongest.length > 0) {
    return strongest;
  }

  return items
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 6);
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildSummary(task: string, items: MemoryItem[], repoScan: RepoScan) {
  const decisionHints = items
    .filter((item) => item.type.includes("decision") || item.type.includes("project"))
    .slice(0, 2)
    .map((item) => item.title);

  const activeAreas = dedupe(
    items.flatMap((item) => item.related_files).filter((file) => file.length > 0),
  ).slice(0, 4);

  const summaryParts = [
    `Task focus: ${task}.`,
    decisionHints.length
      ? `Relevant decisions: ${decisionHints.join("; ")}.`
      : "Relevant decisions are limited, so verify assumptions before editing.",
    activeAreas.length
      ? `Likely code areas: ${activeAreas.join(", ")}.`
      : "Repo scan did not reveal a strong file match for this task.",
    `Framework: ${repoScan.framework}. Branch: ${repoScan.branch}.`,
  ];

  return summaryParts.join(" ");
}

export function renderCapsuleMarkdown(task: string, capsule: Capsule) {
  return [
    `# Context Capsule: ${task}`,
    "",
    "## Goal",
    "",
    capsule.goal,
    "",
    "## Summary",
    "",
    capsule.summary,
    "",
    "## Relevant Context",
    "",
    ...capsule.relevant_context.map((line) => `- ${line}`),
    "",
    "## Files Likely Needed",
    "",
    ...capsule.files_likely_needed.map((line) => `- \`${line}\``),
    "",
    "## Files To Avoid",
    "",
    ...capsule.files_to_avoid.map((line) => `- \`${line}\``),
    "",
    "## Previous Errors To Remember",
    "",
    ...capsule.previous_errors_to_remember.map((line) => `- ${line}`),
    "",
    "## Commands To Run",
    "",
    ...capsule.commands_to_run.map((line) => `- \`${line}\``),
    "",
    "## AI-Agent Prompt",
    "",
    "```md",
    capsule.agent_prompt,
    "```",
    "",
    `Estimated context reduction: ${capsule.saved_percent}%`,
  ].join("\n");
}

export function createDeterministicCapsule(
  task: string,
  memoryFiles: MemoryFile[],
  repoScan: RepoScan,
): Capsule {
  const relevantItems = getRelevantItems(task, memoryFiles);
  const relevantContext = relevantItems.map(
    (item) => `${item.title}: ${item.content.slice(0, 220)}`,
  );
  const filesLikelyNeeded = dedupe(
    relevantItems.flatMap((item) => item.related_files),
  ).slice(0, 10);
  const filesToAvoid = dedupe(
    memoryFiles
      .find((file) => file.file_key === "FAILED_ATTEMPTS")
      ?.items.flatMap((item) => item.related_files) ?? [],
  ).slice(0, 6);
  const previousErrors = memoryFiles
    .find((file) => file.file_key === "BUGS_AND_FIXES")
    ?.items.slice(0, 4)
    .map((item) => `${item.title}: ${item.content.slice(0, 180)}`) ?? [];
  const commands = dedupe([
    repoScan.scripts.dev ? "npm run dev" : "",
    repoScan.scripts.test ? "npm run test" : "",
    repoScan.scripts.lint ? "npm run lint" : "",
  ]).slice(0, 4);

  const capsuleDraft = {
    goal: task,
    summary: buildSummary(task, relevantItems, repoScan),
    relevant_context:
      relevantContext.length > 0
        ? relevantContext
        : ["No high-confidence matching memory items were found. Verify assumptions."],
    files_likely_needed: filesLikelyNeeded,
    files_to_avoid: filesToAvoid,
    previous_errors_to_remember: previousErrors,
    commands_to_run: commands,
    agent_prompt: [
      `You are working on: ${task}`,
      `Framework: ${repoScan.framework}`,
      "Use the relevant context below before editing code:",
      ...relevantContext.map((line) => `- ${line}`),
      filesLikelyNeeded.length
        ? `Prioritize these files: ${filesLikelyNeeded.join(", ")}`
        : "No confident file shortlist exists, so inspect the repo carefully first.",
      previousErrors.length
        ? `Do not repeat these mistakes: ${previousErrors.join(" | ")}`
        : "No prior bug memory matched the task strongly.",
    ].join("\n"),
    estimated_raw_tokens: 0,
    estimated_capsule_tokens: 0,
    saved_percent: 0,
  };

  const rawText = JSON.stringify({
    relevantItems,
    repoScan,
  });
  const markdown = renderCapsuleMarkdown(task, capsuleDraft);
  const savings = estimateSavings(rawText, markdown);

  return {
    ...capsuleDraft,
    estimated_raw_tokens: savings.estimatedRawTokens,
    estimated_capsule_tokens: savings.estimatedCapsuleTokens,
    saved_percent: savings.savedPercent,
  };
}
