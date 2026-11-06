import path from "node:path";
import { writeFile } from "node:fs/promises";

import { calculateMemoryHealthScore } from "../../lib/memory/drift";
import { createDeterministicCapsule } from "../../lib/memory/capsule";
import { generateExports } from "../../lib/memory/export";
import {
  listSavedCapsules,
  loadMemoryFiles,
  readRepoScan,
} from "../../lib/memory/engine";
import { ensureDir, pathExists } from "../../lib/utils/fs";

export async function runExportCommand(
  workspaceRoot = process.cwd(),
  options: { force?: boolean } = {},
) {
  const memoryFiles = await loadMemoryFiles(workspaceRoot);
  const repoScan = await readRepoScan(workspaceRoot);
  const capsules = await listSavedCapsules(workspaceRoot);
  // Regenerate the latest saved capsule deterministically so the exported
  // CONTEXTFORGE_CAPSULE.md reflects real memory instead of a placeholder
  // (the dashboard path does the same via generateProjectExports).
  const latestCapsule = capsules[0]
    ? createDeterministicCapsule(capsules[0].task, memoryFiles, repoScan)
    : null;
  const exportsBundle = generateExports({
    projectName: path.basename(workspaceRoot),
    projectDescription: "ContextForge local export bundle",
    memoryFiles,
    repoScan,
    latestCapsule,
    driftIssues: [],
  });

  // Fail before writing anything if any generated target already exists.
  const collisions: string[] = [];
  for (const target of Object.keys(exportsBundle)) {
    if (await pathExists(path.join(workspaceRoot, target))) {
      collisions.push(target);
    }
  }
  if (collisions.length && !options.force) {
    throw new Error(
      `Export refused to overwrite existing files: ${collisions.join(", ")}. ` +
        "Back up your files and pass --force if replacement is intentional.",
    );
  }

  for (const [target, content] of Object.entries(exportsBundle)) {
    const absolutePath = path.join(workspaceRoot, target);
    await ensureDir(path.dirname(absolutePath));
    await writeFile(absolutePath, content, "utf8");
    console.log(`Wrote ${target}`);
  }

  console.log(`Exported ${Object.keys(exportsBundle).length} files.`);
  console.log(`Saved capsules available: ${capsules.length}`);
  console.log(`Memory health baseline: ${calculateMemoryHealthScore([])}/100`);
}
