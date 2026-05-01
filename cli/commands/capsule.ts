import { generateCapsuleFromMemory } from "@/lib/ai";
import { loadMemoryFiles, readRepoScan, saveCapsule } from "@/lib/memory/engine";
import { renderCapsuleMarkdown } from "@/lib/memory/capsule";

export async function runCapsuleCommand(task: string, workspaceRoot = process.cwd()) {
  const memoryFiles = await loadMemoryFiles(workspaceRoot);
  const repoScan = await readRepoScan(workspaceRoot);
  const { capsule, provider } = await generateCapsuleFromMemory(
    task,
    memoryFiles,
    repoScan,
  );

  const markdown = renderCapsuleMarkdown(task, capsule);
  const saved = await saveCapsule(workspaceRoot, task, capsule);

  console.log(markdown);
  console.log(`\nSaved capsule to ${saved.filePath}`);
  if (provider.warning) {
    console.log(provider.warning);
  }
}
