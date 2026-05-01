import { randomUUID } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

import { isoNow } from "@/lib/utils/date";
import {
  ensureDir,
  pathExists,
  readJsonIfExists,
  readTextIfExists,
  writeJsonPretty,
} from "@/lib/utils/fs";
import { slugify } from "@/lib/utils/slug";

import { parseMemoryFile, renderMemoryFile } from "./markdown";
import {
  CapsuleSchema,
  MemoryFileKeySchema,
  RepoScanSchema,
  type Capsule,
  type ExtractedMemory,
  type MemoryFile,
  type MemoryFileKey,
  type MemoryItem,
} from "./schemas";

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
    "- `npx contextforge remember \"...\"` to append durable memory.",
    "- `npx contextforge scan` to refresh repo scan facts.",
    "- `npx contextforge capsule \"task\"` to generate a task-specific capsule.",
    "- `npx contextforge doctor` to detect memory drift.",
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

export async function saveMemoryFile(workspaceRoot: string, file: MemoryFile) {
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

function inferFileKeyFromText(text: string): MemoryFileKey {
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

  if (/(route|endpoint|payload|response|table|schema|api)/.test(lowered)) {
    return "API_CONTRACTS";
  }

  if (/(npm|pnpm|yarn|bun|env|install|setup|supabase|ollama|gemini)/.test(lowered)) {
    return "ENV_AND_SETUP";
  }

  if (/(decision|decided|because|tradeoff|alternative)/.test(lowered)) {
    return "DECISIONS";
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
  const file = await loadMemoryFile(workspaceRoot, fileKey);
  const timestamp = isoNow();
  const item: MemoryItem = {
    id: randomUUID(),
    created_at: timestamp,
    updated_at: timestamp,
    ...itemInput,
  };

  const nextFile: MemoryFile = {
    ...file,
    summary: updateSummary(file.summary, item),
    items: [item, ...file.items].slice(0, 50),
    version: file.version + 1,
    updated_at: timestamp,
  };

  await saveMemoryFile(workspaceRoot, nextFile);
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

export async function remember(workspaceRoot: string, text: string) {
  const fileKey = inferFileKeyFromText(text);
  return appendMemoryItem(workspaceRoot, fileKey, {
    type: fileKey.toLowerCase(),
    title: buildItemTitle(text),
    content: text,
    source: "cli:remember",
    confidence: 0.86,
    related_files: [],
    tags: ["remember"],
  });
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
  const filePath = path.join(getCapsulesDir(workspaceRoot), `${datePrefix}-${slug}.md`);
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

  const capsules = await Promise.all(
    files.map(async (entry) => {
      const filePath = path.join(capsuleDir, entry.name);
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
    }),
  );

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
