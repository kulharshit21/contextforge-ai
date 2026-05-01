import { remember } from "@/lib/memory/engine";

export async function runRememberCommand(text: string, workspaceRoot = process.cwd()) {
  const item = await remember(workspaceRoot, text);
  console.log(`Saved note to ${item.type.toUpperCase()}: ${item.title}`);
}
