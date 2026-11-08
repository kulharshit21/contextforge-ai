import { remember } from "../../lib/memory/engine";

export async function runRememberCommand(text: string, workspaceRoot = process.cwd()) {
  const { item, nearDuplicateOf } = await remember(workspaceRoot, text);
  if (nearDuplicateOf) {
    console.error(`Warning: near-duplicate of record ${nearDuplicateOf}; saving anyway. Use --supersedes if this replaces it.`);
  }
  console.log(`Saved note to ${item.type.toUpperCase()}: ${item.title}`);
}
