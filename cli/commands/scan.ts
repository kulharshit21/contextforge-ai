import { scanRepository } from "@/lib/repo/scanner";
import { writeRepoScan } from "@/lib/memory/engine";

export async function runScanCommand(workspaceRoot = process.cwd()) {
  const scan = await scanRepository(workspaceRoot);
  await writeRepoScan(workspaceRoot, scan);

  console.log("Repo scan saved to .contextforge/repo-scan.json");
  console.log(`Framework: ${scan.framework}`);
  console.log(`Branch: ${scan.branch}`);
  console.log(`App routes: ${scan.app_routes.length}`);
  console.log(`API routes: ${scan.api_routes.length}`);
  if (scan.warnings.length) {
    console.log("Warnings:");
    for (const warning of scan.warnings) {
      console.log(`- ${warning}`);
    }
  }
}
