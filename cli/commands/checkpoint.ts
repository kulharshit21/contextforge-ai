import { checkpointMemory } from "../../lib/memory/engine";
import { type JournalEventKind, JOURNAL_EVENT_KINDS } from "../../lib/memory/schemas";

export type CheckpointCommandOptions = {
  kind?: string;
  source?: string;
  tags?: string;
  supersedes?: string;
  noSync?: boolean;
  breakLock?: boolean;
};

export async function runCheckpointCommand(
  text: string,
  options: CheckpointCommandOptions = {},
  workspaceRoot = process.cwd(),
) {
  let kind: JournalEventKind | undefined = undefined;
  if (options.kind) {
    const normalized = options.kind.toLowerCase() as JournalEventKind;
    if (!JOURNAL_EVENT_KINDS.includes(normalized)) {
      throw new Error(
        `Invalid kind: '${options.kind}'. Must be one of: ${JOURNAL_EVENT_KINDS.join(", ")}`,
      );
    }
    kind = normalized;
  }

  const tags = options.tags ? options.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

  const result = await checkpointMemory(workspaceRoot, {
    text,
    kind,
    source: options.source,
    tags,
    supersedes: options.supersedes,
    noSync: options.noSync,
    breakLock: options.breakLock,
  });

  const status = result.created ? "Saved" : "Duplicate not saved";
  console.log(`${status}: [${result.event.kind}] ${result.event.id}`);
  if (result.item) {
    console.log(`Synced to Markdown: ${result.fileKey} (${result.item.id})`);
  }
}
