import { formatDateTime } from "@/lib/utils/date";

import type { Capsule, DriftIssue, MemoryFile, RepoScan } from "./schemas";

type ExportContext = {
  projectName: string;
  projectDescription: string;
  memoryFiles: MemoryFile[];
  repoScan: RepoScan;
  latestCapsule: Capsule | null;
  driftIssues: DriftIssue[];
};

function collectLines(memoryFiles: MemoryFile[], fileKey: MemoryFile["file_key"], limit = 4) {
  return (
    memoryFiles
      .find((file) => file.file_key === fileKey)
      ?.items.slice(0, limit)
      .map((item) => `${item.title}: ${item.content}`) ?? []
  );
}

function extractCommands(memoryFiles: MemoryFile[], repoScan: RepoScan) {
  const envLines = collectLines(memoryFiles, "ENV_AND_SETUP", 6).join("\n");
  const commands = envLines.match(/\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?[a-z0-9:-]+\b/gi) ?? [];
  return [...new Set([...commands, repoScan.scripts.dev ? "npm run dev" : "", repoScan.scripts.test ? "npm run test" : ""])].filter(Boolean);
}

function renderProjectOverview(context: ExportContext) {
  return [
    `Project overview: ${context.projectDescription || context.projectName}.`,
    `Framework: ${context.repoScan.framework}.`,
    context.repoScan.readme_summary || "README summary unavailable.",
  ].join(" ");
}

function renderWarnings(context: ExportContext) {
  const warnings = [
    ...collectLines(context.memoryFiles, "CODING_RULES", 4),
    ...collectLines(context.memoryFiles, "BUGS_AND_FIXES", 3),
  ];
  return warnings.length ? warnings : ["Do not bypass Supabase RLS policies."];
}

function renderArchitecture(context: ExportContext) {
  const architectureLines = collectLines(context.memoryFiles, "ARCHITECTURE", 4);
  if (architectureLines.length > 0) {
    return architectureLines;
  }

  return [
    `App routes: ${context.repoScan.app_routes.slice(0, 6).join(", ") || "none"}`,
    `API routes: ${context.repoScan.api_routes.slice(0, 6).join(", ") || "none"}`,
  ];
}

function buildAgentsMd(context: ExportContext) {
  return [
    "# AGENTS.md",
    "",
    renderProjectOverview(context),
    "",
    "## Setup Commands",
    "",
    ...extractCommands(context.memoryFiles, context.repoScan).map((line) => `- \`${line}\``),
    "",
    "## Architecture",
    "",
    ...renderArchitecture(context).map((line) => `- ${line}`),
    "",
    "## Coding Style",
    "",
    ...collectLines(context.memoryFiles, "CODING_RULES", 4).map((line) => `- ${line}`),
    "",
    "## Important Warnings",
    "",
    ...renderWarnings(context).map((line) => `- ${line}`),
    "",
    "## Current Task Guidance",
    "",
    ...collectLines(context.memoryFiles, "CURRENT_TASKS", 4).map((line) => `- ${line}`),
  ].join("\n");
}

function buildClaudeMd(context: ExportContext) {
  return [
    "# CLAUDE.md",
    "",
    renderProjectOverview(context),
    "",
    "## Memory Index",
    "",
    ...context.memoryFiles.map((file) => `- .contextforge/${file.file_key}.md`),
    "",
    "## Setup",
    "",
    ...extractCommands(context.memoryFiles, context.repoScan).map((line) => `- \`${line}\``),
    "",
    "## Important Constraints",
    "",
    ...renderWarnings(context).map((line) => `- ${line}`),
  ].join("\n");
}

function buildGeminiMd(context: ExportContext) {
  return [
    "# GEMINI.md",
    "",
    renderProjectOverview(context),
    "",
    "## Working Rules",
    "",
    ...collectLines(context.memoryFiles, "CODING_RULES", 5).map((line) => `- ${line}`),
    "",
    "## Architecture Snapshot",
    "",
    ...renderArchitecture(context).map((line) => `- ${line}`),
    "",
    "## Commands",
    "",
    ...extractCommands(context.memoryFiles, context.repoScan).map((line) => `- \`${line}\``),
  ].join("\n");
}

function buildCursorRules(context: ExportContext) {
  return [
    "---",
    "description: ContextForge project memory",
    "alwaysApply: true",
    "---",
    "",
    `Project: ${context.projectName}`,
    `Framework: ${context.repoScan.framework}`,
    "",
    "Key rules:",
    ...renderWarnings(context).map((line) => `- ${line}`),
    "",
    "Current tasks:",
    ...collectLines(context.memoryFiles, "CURRENT_TASKS", 4).map((line) => `- ${line}`),
  ].join("\n");
}

function buildCopilotInstructions(context: ExportContext) {
  return [
    "# GitHub Copilot Instructions",
    "",
    renderProjectOverview(context),
    "",
    "## Setup and Test Commands",
    "",
    ...extractCommands(context.memoryFiles, context.repoScan).map((line) => `- \`${line}\``),
    "",
    "## Coding Standards",
    "",
    ...collectLines(context.memoryFiles, "CODING_RULES", 5).map((line) => `- ${line}`),
    "",
    "## Common Pitfalls",
    "",
    ...renderWarnings(context).map((line) => `- ${line}`),
  ].join("\n");
}

function buildCapsuleExport(context: ExportContext) {
  if (!context.latestCapsule) {
    return "# CONTEXTFORGE_CAPSULE.md\n\nNo capsule has been generated yet.";
  }

  return [
    "# CONTEXTFORGE_CAPSULE.md",
    "",
    `Generated: ${formatDateTime(new Date().toISOString())}`,
    "",
    "## Summary",
    "",
    context.latestCapsule.summary,
    "",
    "## Agent Prompt",
    "",
    "```md",
    context.latestCapsule.agent_prompt,
    "```",
  ].join("\n");
}

function buildMemoryJson(context: ExportContext) {
  return JSON.stringify(
    {
      projectName: context.projectName,
      projectDescription: context.projectDescription,
      repoScan: context.repoScan,
      memoryFiles: context.memoryFiles,
      latestCapsule: context.latestCapsule,
      driftIssues: context.driftIssues,
    },
    null,
    2,
  );
}

function buildMcpManifest(context: ExportContext) {
  return JSON.stringify(
    {
      name: "contextforge-memory",
      version: 1,
      resources: [
        { key: "project_state", path: ".contextforge/PROJECT_STATE.md" },
        { key: "architecture", path: ".contextforge/ARCHITECTURE.md" },
        { key: "decisions", path: ".contextforge/DECISIONS.md" },
        { key: "bugs", path: ".contextforge/BUGS_AND_FIXES.md" },
        { key: "current_tasks", path: ".contextforge/CURRENT_TASKS.md" },
      ],
      project: context.projectName,
    },
    null,
    2,
  );
}

export function generateExports(context: ExportContext) {
  return {
    "AGENTS.md": buildAgentsMd(context),
    "CLAUDE.md": buildClaudeMd(context),
    "GEMINI.md": buildGeminiMd(context),
    ".cursor/rules/project-memory.mdc": buildCursorRules(context),
    ".github/copilot-instructions.md": buildCopilotInstructions(context),
    "CONTEXTFORGE_CAPSULE.md": buildCapsuleExport(context),
    ".contextforge/EXPORTS/contextforge-memory.json": buildMemoryJson(context),
    ".contextforge/EXPORTS/mcp-manifest.json": buildMcpManifest(context),
  };
}
