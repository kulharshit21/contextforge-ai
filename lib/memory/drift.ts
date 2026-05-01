import path from "node:path";

import { type DriftIssue, type MemoryFile, type RepoScan } from "./schemas";

const FRAMEWORK_KEYWORDS: Record<string, RegExp> = {
  "Next.js": /\bnext(?:\.js)?\b/i,
  Express: /\bexpress\b/i,
  FastAPI: /\bfastapi\b/i,
};

function flattenMemory(memoryFiles: MemoryFile[]) {
  return memoryFiles
    .flatMap((file) => [file.summary, ...file.items.map((item) => `${item.title}\n${item.content}`)])
    .join("\n\n");
}

function extractCommands(input: string) {
  const matches = input.match(/\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?[a-z0-9:-]+\b/gi);
  return [...new Set(matches ?? [])];
}

function extractEnvVars(input: string) {
  const matches = input.match(/\b[A-Z][A-Z0-9_]{2,}\b/g);
  return [...new Set(matches ?? [])];
}

export function calculateMemoryHealthScore(issues: DriftIssue[]) {
  const penalties = issues.reduce((total, issue) => {
    if (issue.severity === "high") {
      return total + 20;
    }

    if (issue.severity === "medium") {
      return total + 10;
    }

    return total + 4;
  }, 0);

  return Math.max(22, 100 - penalties);
}

export function detectMemoryDrift(
  workspaceRoot: string,
  memoryFiles: MemoryFile[],
  repoScan: RepoScan,
) {
  const issues: DriftIssue[] = [];
  const memoryText = flattenMemory(memoryFiles);
  const fileUniverse = new Set([
    ...repoScan.files_inspected,
    ...repoScan.app_routes,
    ...repoScan.api_routes,
    ...repoScan.library_files,
    ...repoScan.database_migrations,
    ...repoScan.test_files,
  ]);

  for (const [framework, pattern] of Object.entries(FRAMEWORK_KEYWORDS)) {
    if (framework === repoScan.framework) {
      continue;
    }

    if (pattern.test(memoryText)) {
      issues.push({
        severity: "high",
        title: `Memory mentions ${framework}, repo scan says ${repoScan.framework}`,
        description:
          "Saved project memory still references a different framework than the current repository scan.",
        suggested_fix: `Update PROJECT_STATE.md and ARCHITECTURE.md so they reflect ${repoScan.framework} instead of ${framework}.`,
        evidence: [`Repo scan framework: ${repoScan.framework}`, `Detected keyword for ${framework} in memory.`],
        status: "open",
      });
    }
  }

  const memoryCommands = extractCommands(memoryText);
  for (const command of memoryCommands) {
    const scriptName = command.split(/\s+/).pop() ?? "";
    if (command.includes("run") && scriptName && !(scriptName in repoScan.scripts)) {
      issues.push({
        severity: "medium",
        title: `Command referenced in memory is missing: ${command}`,
        description:
          "Memory includes a runnable command that is not present in package.json scripts from the latest repo scan.",
        suggested_fix: `Either add the missing script "${scriptName}" back, or update ENV_AND_SETUP.md and CURRENT_TASKS.md to a valid command.`,
        evidence: [`Memory command: ${command}`],
        status: "open",
      });
    }
  }

  const relatedFiles = memoryFiles.flatMap((file) =>
    file.items.flatMap((item) => item.related_files),
  );

  for (const relatedFile of [...new Set(relatedFiles)]) {
    const normalized = relatedFile.replace(/\\/g, "/");
    if (!fileUniverse.has(normalized)) {
      issues.push({
        severity: "medium",
        title: `Memory references a file not seen in the repo scan: ${normalized}`,
        description:
          "A memory item points to a file that the latest repo scan did not find. The file may have moved, been deleted, or been renamed.",
        suggested_fix: `Update the related file references for ${normalized} or rescan the repo if the file was recently added.`,
        evidence: [`Related file: ${normalized}`, `Workspace root: ${path.basename(workspaceRoot)}`],
        status: "open",
      });
    }
  }

  const memoryEnvVars = extractEnvVars(memoryText);
  const envReferenceText = repoScan.env_examples.join("\n");
  for (const envVar of memoryEnvVars) {
    if (
      envVar.startsWith("NEXT_") ||
      envVar.startsWith("SUPABASE_") ||
      envVar.startsWith("GEMINI_") ||
      envVar.startsWith("OLLAMA_") ||
      envVar.startsWith("CONTEXTFORGE_")
    ) {
      const foundInExamples = envReferenceText.includes(envVar);
      if (!foundInExamples) {
        issues.push({
          severity: "low",
          title: `Environment variable may be undocumented: ${envVar}`,
          description:
            "Memory mentions an environment variable that was not found in env example files from the repo scan.",
          suggested_fix: `Add ${envVar} to .env.example or update ENV_AND_SETUP.md if the variable is obsolete.`,
          evidence: [`Missing from env examples: ${envVar}`],
          status: "open",
        });
      }
    }
  }

  return issues;
}
