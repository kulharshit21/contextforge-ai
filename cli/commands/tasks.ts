import { appendJournalEvent, getActiveEvents, readJournalEvents } from "../../lib/memory/journal";
import { relativeDate } from "../../lib/utils/date";

export type TasksCommandOptions = {
  done?: string;
};

const VALID_ID = /^[a-f0-9]{12}$/;

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : relativeDate(parsed.toISOString());
}

/** List open `next` records from the active journal, newest first. */
export async function runTasksCommand(
  options: TasksCommandOptions = {},
  workspaceRoot = process.cwd(),
) {
  const events = await readJournalEvents(workspaceRoot);
  const active = getActiveEvents(events);
  const openTasks = active
    .filter((event) => event.kind === "next")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (!options.done) {
    if (openTasks.length === 0) {
      console.log("No open tasks. Save one with: contextforge handoff \"task\" --next \"...\"");
      return;
    }
    console.log(`Open tasks (${openTasks.length}):`);
    for (const task of openTasks) {
      console.log(`- ${task.id}  (${formatDate(task.created_at)})  ${task.text}`);
    }
    console.log("Mark one done with: contextforge tasks --done <id>");
    return;
  }

  const doneId = options.done.trim();
  if (!VALID_ID.test(doneId)) {
    throw new Error("--done must be a 12-character record id (see 'contextforge tasks')");
  }
  const target = openTasks.find((event) => event.id === doneId);
  if (!target) {
    throw new Error(`No open next-record with id ${doneId}. Run 'contextforge tasks' to list open tasks.`);
  }

  // Marking done supersedes the next-record with a handoff record so the
  // task leaves the active queue while its completion stays in the journal.
  // allowNearDuplicate: the completion record intentionally mirrors the
  // original text, which the near-dup warning would otherwise fire on.
  const { created } = await appendJournalEvent(workspaceRoot, {
    kind: "handoff",
    text: `Done: ${target.text}`,
    source: target.source || "cli:tasks",
    tags: ["task-done"],
    supersedes: doneId,
    allowNearDuplicate: true,
  });

  if (!created) {
    console.log("Task was already marked done.");
    return;
  }
  const remaining = openTasks.length - 1;
  console.log(`Marked done: ${doneId} — ${target.text}`);
  console.log(`Open tasks remaining: ${remaining}`);
}
