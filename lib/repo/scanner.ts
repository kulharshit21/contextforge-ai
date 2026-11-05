import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import { simpleGit } from "simple-git";

import { isoNow } from "../utils/date";
import { pathExists } from "../utils/fs";

import { RepoScanSchema, type RepoScan } from "../memory/schemas";

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

// Symlink/junction traversal cannot be reliably disabled in the glob layer on
// all platforms (Windows junctions are still descended into by fast-glob even
// with followSymbolicLinks: false), so every matched file is verified to
// resolve inside the canonical scan root before it is reported or read.
async function filterToRootFiles(workspaceRoot: string, relativePaths: string[]): Promise<string[]> {
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(workspaceRoot);
  } catch {
    return [];
  }

  const kept: string[] = [];
  for (const relativePath of relativePaths) {
    try {
      const realFile = await realpath(path.join(workspaceRoot, relativePath));
      const relative = path.relative(canonicalRoot, realFile);
      const insideRoot = relative !== ".."
        && !relative.startsWith(".." + path.sep)
        && !path.isAbsolute(relative);
      if (insideRoot) {
        kept.push(relativePath);
      }
    } catch {
      // The file vanished between the glob and this check; skip it.
    }
  }
  return kept;
}

// Direct reads must not follow symlinks out of the scan root: a symlinked
// README.md or package.json would otherwise disclose outside file content
// even when the root itself is canonically validated. Symlinks are refused
// uniformly, consistent with the journal and skill-lifecycle policies.
async function readRegularFileIfExists(workspaceRoot: string, filename: string): Promise<string | null> {
  const filePath = path.join(workspaceRoot, filename);
  let stats;
  try {
    stats = await lstat(filePath);
  } catch {
    return null;
  }
  if (stats.isSymbolicLink() || !stats.isFile()) {
    return null;
  }
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function readIgnorePatterns(workspaceRoot: string) {
  const content = await readRegularFileIfExists(workspaceRoot, ".contextforgeignore");
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
    (await readRegularFileIfExists(workspaceRoot, "README.md")) ??
    (await readRegularFileIfExists(workspaceRoot, "readme.md")) ??
    "";

  return readme.replace(/\s+/g, " ").trim().slice(0, 800);
}

// Git metadata can point outside the scan root through a symlinked `.git` or
// a worktree-style `.git` file with a `gitdir:` path to another repository;
// git would then disclose that repository's branch and history. Only trust
// git facts when `.git` is a real directory resolving inside the canonical
// root. Worktree checkouts (whose `.git` is a file) therefore report unknown
// git facts, which is the safe default for an informational scan.
async function hasContainedGitDirectory(workspaceRoot: string): Promise<boolean> {
  const gitPath = path.join(workspaceRoot, ".git");
  let stats;
  try {
    stats = await lstat(gitPath);
  } catch {
    return false;
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    return false;
  }
  try {
    const [realRoot, realGit] = await Promise.all([realpath(workspaceRoot), realpath(gitPath)]);
    const relative = path.relative(realRoot, realGit);
    return relative !== ".."
      && !relative.startsWith(".." + path.sep)
      && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

async function getGitFacts(workspaceRoot: string) {
  if (!(await hasContainedGitDirectory(workspaceRoot))) {
    return {
      branch: "unknown",
      commitHash: "unknown",
      recentCommits: [],
    };
  }

  try {
    const git = simpleGit(workspaceRoot);
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const commitHash = await git.revparse(["HEAD"]);
    const log = await git.log({ maxCount: 6 });

    return {
      branch,
      commitHash,
      recentCommits: log.all.map((commit: { hash: string; message: string; author_name: string; date: string }) => ({
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
  const entries = await filterToRootFiles(
    workspaceRoot,
    await fg(patterns, {
      cwd: workspaceRoot,
      followSymbolicLinks: false,
      ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
      dot: false,
      unique: true,
      onlyFiles: true,
    }),
  );

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
  const packageJsonRaw = await readRegularFileIfExists(workspaceRoot, "package.json");
  const packageJson = packageJsonRaw === null
    ? null
    : (JSON.parse(packageJsonRaw) as Record<string, unknown>);

  const appRoutes = await filterToRootFiles(
    workspaceRoot,
    await fg(["app/**/page.tsx", "src/app/**/page.tsx"], {
      cwd: workspaceRoot,
      followSymbolicLinks: false,
      ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
      onlyFiles: true,
    }),
  );

  const apiRoutes = await filterToRootFiles(
    workspaceRoot,
    await fg(
      ["app/api/**/route.ts", "src/app/api/**/route.ts", "pages/api/**/*.{ts,js}"],
      {
        cwd: workspaceRoot,
        followSymbolicLinks: false,
        ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
        onlyFiles: true,
      },
    ),
  );

  const libraryFiles = await filterToRootFiles(
    workspaceRoot,
    await fg(["lib/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"], {
      cwd: workspaceRoot,
      followSymbolicLinks: false,
      ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
      onlyFiles: true,
    }),
  );

  const databaseMigrations = await filterToRootFiles(
    workspaceRoot,
    await fg(
      ["supabase/migrations/**/*.sql", "prisma/migrations/**/*", "db/migrations/**/*"],
      {
        cwd: workspaceRoot,
        followSymbolicLinks: false,
        ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
        onlyFiles: true,
      },
    ),
  );

  const envExamples = await filterToRootFiles(
    workspaceRoot,
    await fg([".env.example", ".env*.example", "**/*.env.example"], {
      cwd: workspaceRoot,
      followSymbolicLinks: false,
      ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
      onlyFiles: true,
    }),
  );

  const testFiles = await filterToRootFiles(
    workspaceRoot,
    await fg(
      ["**/*.{test,spec}.{ts,tsx,js,jsx}", "tests/**/*.{ts,tsx,js,jsx}"],
      {
        cwd: workspaceRoot,
        followSymbolicLinks: false,
        ignore: [...DEFAULT_IGNORE_PATTERNS, ...(await readIgnorePatterns(workspaceRoot))],
        onlyFiles: true,
      },
    ),
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
