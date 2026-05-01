import { readFile } from "node:fs/promises";
import path from "node:path";

import { extractMemoryFromChat } from "@/lib/ai";
import { mergeExtractedMemory } from "@/lib/memory/engine";

export async function runIngestChatCommand(
  inputPath: string,
  workspaceRoot = process.cwd(),
) {
  const absolutePath = path.resolve(process.cwd(), inputPath);
  const chatText = await readFile(absolutePath, "utf8");
  const extraction = await extractMemoryFromChat(chatText, "Full extraction");
  const createdItems = await mergeExtractedMemory(
    workspaceRoot,
    extraction.extracted,
    `chat-ingest:${path.basename(inputPath)}`,
  );

  console.log(`Ingested ${createdItems.length} durable memory items from ${inputPath}.`);
  if (extraction.provider.warning) {
    console.log(extraction.provider.warning);
  }
}
