import { remember } from "../../lib/memory/engine";

export async function runRememberCommand(text: string, workspaceRoot = process.cwd()) {
  const { item, created } = await remember(workspaceRoot, text);
  if (!created) {
    console.log(`Duplicate not saved: ${item.type.toUpperCase()}: ${item.title}`);
    return;
  }
  console.log(`Saved note to ${item.type.toUpperCase()}: ${item.title}`);
}
