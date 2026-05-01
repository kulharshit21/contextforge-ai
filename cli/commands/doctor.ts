import { analyzeMemoryDrift } from "@/lib/ai";
import { calculateMemoryHealthScore } from "@/lib/memory/drift";
import { loadMemoryFiles, readRepoScan } from "@/lib/memory/engine";

export async function runDoctorCommand(workspaceRoot = process.cwd()) {
  const memoryFiles = await loadMemoryFiles(workspaceRoot);
  const repoScan = await readRepoScan(workspaceRoot);
  const analysis = await analyzeMemoryDrift(workspaceRoot, memoryFiles, repoScan);
  const score = calculateMemoryHealthScore(analysis.issues);

  console.log(`Memory health score: ${score}/100`);

  if (!analysis.issues.length) {
    console.log("No drift issues found.");
    return;
  }

  console.log("Drift issues:");
  for (const issue of analysis.issues) {
    console.log(`- [${issue.severity}] ${issue.title}`);
    console.log(`  ${issue.suggested_fix}`);
  }

  if (analysis.provider.warning) {
    console.log(analysis.provider.warning);
  }
}
