import { stat } from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import simpleGit from "simple-git";

import { isoNow } from "@/lib/utils/date";
import { pathExists, readJsonIfExists, readTextIfExists } from "@/lib/utils/fs";

import { RepoScanSchema, type RepoScan } from "@/lib/memory/schemas";

const DEFAULT_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.next/**",
  "**/.contextforge/**",
  "**/dist/**",
  "**/build/**",
  "**/.env",
  "**/.env.local",
  "**/.env.*",
  "**/*.pem",
  "**/*secret*",
  "**/*private*key*",
  "**/*.png",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.gif",
  "**/*.webp",
  "**/*.pdf",
  "**/*.zip",
  "**/*.mp4",
  "**/*.mp3",
];

const MAX_FILE_SIZE_BYTES = 256_000;
const MAX_TOTAL_SCAN_BYTES = 4_000_000;

async function readIgnorePatterns(workspaceRoot: string) {
  const ignoreFilePath = path.join(workspaceRoot, ".contextforgeignore");
  const content = await readTextIfExists(ignoreFilePath);

  if (!content) {
    return [];
  }

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

async function detectPackageManager(workspaceRoot: string) {
  if (await pathExists(path.join(workspaceRoot, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  if (await pathExists(path.join(workspaceRoot, "yarn.lock"))) {
    return "yarn";
  }

  if (await pathExists(path.join(workspaceRoot, "bun.lock"))) {
    return "bun";
  }

  return "npm";
}

function detectFramework(packageJson: Record<string, unknown> | null, files: string[]) {
  const dependencies = {
    ...(typeof packageJson?.dependencies === "object" ? packageJson.dependencies : {}),
    ...(typeof packageJson?.devDependencies === "object"
      ? packageJson.devDependencies
      : {}),
  } as Record<string, string>;

  if ("next" in dependencies || files.some((file) => file.startsWith("app/"))) {
    return "Next.js";
  }

  if ("fastapi" in dependencies || files.some((file) => file.includes("main.py"))) {
    return "FastAPI";
  }

  if ("express" in dependencies) {
    return "Express";
  }

  return "unknown";
}

async function summarizeReadme(workspaceRoot: string) {
  const readme =
    (await readTextIfExists(path.join(workspaceRoot, "README.md"))) ??
    (await readTextIfExists(path.join(workspaceRoot, "readme.md"))) ??
    "";

  return readme.replace(/\s+/g, " ").trim().slice(0, 800);
}

async function getGitFacts(workspaceRoot: string) {
  try {
    const git = simpleGit(workspaceRoot);
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const commitHash = await git.revparse(["HEAD"]);
    const log = await git.log({ maxCount: 6 });

    return {
      branch,
      commitHash,
      recentCommits: log.all.map((commit) => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.author_name,
        date: commit.date,
      })),
    };
  } catch {
    return {
      branch: "unknown",
      commitHash: "unknown",
      recentCommits: [],
    };
  }
}

async function filterSmallTextFiles(workspaceRoot: string, patterns: string[]) {
  const entries = await fg(patterns, {
    cwd: workspaceRoot,
    ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
    dot: false,
    unique: true,
    onlyFiles: true,
  });

  const files: string[] = [];
  let bytesRead = 0;
  const warnings: string[] = [];

  for (const relativePath of entries) {
    const absolutePath = path.join(workspaceRoot, relativePath);
    const fileStat = await stat(absolutePath);

    if (fileStat.size > MAX_FILE_SIZE_BYTES) {
      warnings.push(`Skipped oversized file: ${relativePath}`);
      continue;
    }

    if (bytesRead + fileStat.size > MAX_TOTAL_SCAN_BYTES) {
      warnings.push("Stopped scanning early because the max total scan size was reached.");
      break;
    }

    files.push(relativePath);
    bytesRead += fileStat.size;
  }

  return { files, bytesRead, warnings };
}

export async function scanRepository(workspaceRoot: string): Promise<RepoScan> {
  const packageJson =
    (await readJsonIfExists<Record<string, unknown>>(path.join(workspaceRoot, "package.json"))) ??
    null;

  const appRoutes = await fg(["app/**/page.tsx", "src/app/**/page.tsx"], {
    cwd: workspaceRoot,
    ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
    onlyFiles: true,
  });

  const apiRoutes = await fg(
    ["app/api/**/route.ts", "src/app/api/**/route.ts", "pages/api/**/*.{ts,js}"],
    {
      cwd: workspaceRoot,
      ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
      onlyFiles: true,
    },
  );

  const libraryFiles = await fg(["lib/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"], {
    cwd: workspaceRoot,
    ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
    onlyFiles: true,
  });

  const databaseMigrations = await fg(
    ["supabase/migrations/**/*.sql", "prisma/migrations/**/*", "db/migrations/**/*"],
    {
      cwd: workspaceRoot,
      ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
      onlyFiles: true,
    },
  );

  const envExamples = await fg([".env.example", ".env*.example", "**/*.env.example"], {
    cwd: workspaceRoot,
    ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
    onlyFiles: true,
  });

  const testFiles = await fg(
    ["**/*.{test,spec}.{ts,tsx,js,jsx}", "tests/**/*.{ts,tsx,js,jsx}"],
    {
      cwd: workspaceRoot,
      ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
      onlyFiles: true,
    },
  );

  const textScan = await filterSmallTextFiles(workspaceRoot, [
    "package.json",
    "tsconfig*.json",
    "next.config.*",
    "README.md",
    "app/**/*.{ts,tsx,md}",
    "src/**/*.{ts,tsx,md}",
    "lib/**/*.{ts,tsx,md}",
    "components/**/*.{ts,tsx,md}",
    "supabase/migrations/**/*.sql",
  ]);

  const gitFacts = await getGitFacts(workspaceRoot);
  const packageManager = await detectPackageManager(workspaceRoot);
  const framework = detectFramework(packageJson, [...appRoutes, ...apiRoutes]);
  const scripts =
    typeof packageJson?.scripts === "object"
      ? (packageJson.scripts as Record<string, string>)
      : {};

  return RepoScanSchema.parse({
    workspace_root: workspaceRoot,
    framework,
    package_manager: packageManager,
    scripts,
    app_routes: appRoutes.sort(),
    api_routes: apiRoutes.sort(),
    library_files: libraryFiles.sort(),
    database_migrations: databaseMigrations.sort(),
    env_examples: envExamples.sort(),
    test_files: testFiles.sort(),
    readme_summary: await summarizeReadme(workspaceRoot),
    branch: gitFacts.branch,
    commit_hash: gitFacts.commitHash,
    recent_commits: gitFacts.recentCommits,
    files_inspected: textScan.files,
    warnings: textScan.warnings,
    totals: {
      file_count: textScan.files.length,
      bytes_read: textScan.bytesRead,
    },
    scanned_at: isoNow(),
  });
}
