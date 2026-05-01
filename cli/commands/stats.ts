import { calculateMemoryHealthScore } from "@/lib/memory/drift";
import { listSavedCapsules, loadMemoryFiles, readRepoScan } from "@/lib/memory/engine";
import { analyzeMemoryDrift } from "@/lib/ai";
import { relativeDate } from "@/lib/utils/date";

export async function runStatsCommand(workspaceRoot = process.cwd()) {
  const memoryFiles = await loadMemoryFiles(workspaceRoot);
  const capsules = await listSavedCapsules(workspaceRoot);
  const repoScan = await readRepoScan(workspaceRoot);
  const analysis = await analyzeMemoryDrift(workspaceRoot, memoryFiles, repoScan);
  const staleFiles = memoryFiles
    .filter((file) => {
      const updatedAt = new Date(file.updated_at).getTime();
      return Date.now() - updatedAt > 1000 * 60 * 60 * 24 * 14;
    })
    .map((file) => file.file_key);

  const approximateSavings = capsules.reduce(
    (total, capsule) => total + (capsule.estimatedRawTokens - capsule.estimatedCapsuleTokens),
    0,
  );

  console.log(`Memory files: ${memoryFiles.length}`);
  console.log(`Capsules generated: ${capsules.length}`);
  console.log(`Approximate token savings: ${approximateSavings}`);
  console.log(`Drift warnings: ${analysis.issues.length}`);
  console.log(`Memory health score: ${calculateMemoryHealthScore(analysis.issues)}/100`);

  if (capsules[0]) {
    console.log(`Latest capsule: ${capsules[0].task} (${relativeDate(capsules[0].createdAt)})`);
  }

  if (staleFiles.length) {
    console.log(`Stale memory files: ${staleFiles.join(", ")}`);
  }
}
