import path from "node:path";
import { writeFile } from "node:fs/promises";

import { calculateMemoryHealthScore } from "@/lib/memory/drift";
import { generateExports } from "@/lib/memory/export";
import {
  listSavedCapsules,
  loadMemoryFiles,
  readRepoScan,
} from "@/lib/memory/engine";
import { ensureDir } from "@/lib/utils/fs";

export async function runExportCommand(workspaceRoot = process.cwd()) {
  const memoryFiles = await loadMemoryFiles(workspaceRoot);
  const repoScan = await readRepoScan(workspaceRoot);
  const capsules = await listSavedCapsules(workspaceRoot);
  const exportsBundle = generateExports({
    projectName: path.basename(workspaceRoot),
    projectDescription: "ContextForge local export bundle",
    memoryFiles,
    repoScan,
    latestCapsule: null,
    driftIssues: [],
  });

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
