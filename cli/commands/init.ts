import path from "node:path";

import { getContextForgeDir, initWorkspace } from "@/lib/memory/engine";

export async function runInitCommand(workspaceRoot = process.cwd()) {
  await initWorkspace(workspaceRoot, path.basename(workspaceRoot));

  console.log(`Initialized ContextForge at ${getContextForgeDir(workspaceRoot)}`);
  console.log("Created memory files:");
  console.log("- PROJECT_STATE.md");
  console.log("- ARCHITECTURE.md");
  console.log("- FEATURES.md");
  console.log("- DECISIONS.md");
  console.log("- BUGS_AND_FIXES.md");
  console.log("- FAILED_ATTEMPTS.md");
  console.log("- API_CONTRACTS.md");
  console.log("- ENV_AND_SETUP.md");
  console.log("- CODING_RULES.md");
  console.log("- CURRENT_TASKS.md");
}
