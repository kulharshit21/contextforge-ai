import { syncMemory } from "../../lib/memory/engine";

export async function runSyncCommand(workspaceRoot = process.cwd()) {
  const result = await syncMemory(workspaceRoot);
  console.log(`Synced memory: imported ${result.importedToJournal} items into event journal.`);
}
