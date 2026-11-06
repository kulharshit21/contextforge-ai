import { writeFile } from "node:fs/promises";

import {
  appendMemoryItem,
  buildItemTitle,
  checkpointMemory,
  KIND_TO_FILE_KEY,
  loadMemoryFile,
  recallContext,
} from "../../lib/memory/engine";
import { getActiveEvents, readJournalEvents, refuseSensitive } from "../../lib/memory/journal";
import type { JournalEventKind } from "../../lib/memory/schemas";
import { runRecallCommand } from "./recall";
import { validateOutputPath } from "./output-path";

export type HandoffCommandOptions = {
  done?: string;
  failed?: string;
  test?: string;
  blocker?: string;
  next?: string;
  source?: string;
  budgetChars?: string | number;
  out?: string;
};

export type ResumeCommandOptions = {
  budgetChars?: string | number;
  out?: string;
};

type Note = { kind: JournalEventKind; text: string };

function parseBudget(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const budget = Number(value);
  if (!Number.isInteger(budget) || budget < 500 || budget > 100000) {
    throw new Error("Character budget must be between 500 and 100000");
  }
  return budget;
}

function getTask(taskArg: string): string {
  const task = taskArg.trim();
  if (!task || task.length > 200) {
    throw new Error("Handoff task must be between 1 and 200 characters");
  }
  refuseSensitive(task);
  return task;
}

function getNotes(task: string, options: HandoffCommandOptions): Note[] {
  const fields: Array<{ value?: string; kind: JournalEventKind; label: string }> = [
    { value: options.done, kind: "handoff", label: "Completed" },
    { value: options.failed, kind: "bug", label: "Failed approach (and why)" },
    { value: options.test, kind: "test", label: "Verification result" },
    { value: options.blocker, kind: "blocker", label: "Unresolved blocker" },
    { value: options.next, kind: "next", label: "Next action" },
  ];
  const notes: Note[] = [];
  for (const field of fields) {
    if (field.value === undefined) continue;
    if (!field.value.trim()) throw new Error(`A handoff field cannot be blank: ${field.label}`);
    const text = `${field.label} for ${task}: ${field.value.trim()}`;
    refuseSensitive(text);
    notes.push({ kind: field.kind, text });
  }
  if (notes.length === 0) {
    throw new Error("Nothing to checkpoint. Supply --done, --failed, --test, --blocker, or --next; use 'contextforge resume' to recall without saving.");
  }
  return notes;
}

// Fail early before journaling if the requested output file is occupied, or if
// its parent path contains a symlink. Final writes still use exclusive-create.
// (The implementation lives in ./output-path and is shared with `recall`/`resume`.)

/**
 * Explicitly checkpoint verified end-of-session facts, then return a bounded
 * handoff. Never scrape chat transcripts or infer successes automatically.
 */
export async function runHandoffCommand(
  taskArg: string,
  options: HandoffCommandOptions = {},
  workspaceRoot = process.cwd(),
) {
  const task = getTask(taskArg);
  const budgetChars = parseBudget(options.budgetChars);
  const notes = getNotes(task, options);
  if (options.source) {
    const source = options.source.trim();
    if (source.length > 300 || /[\r\n\x00-\x08\x0b\x0c\x0e-\x1f]/.test(source)) {
      throw new Error("Handoff source must be at most 300 characters, without control characters");
    }
    refuseSensitive(source);
  }
  const destination = await validateOutputPath(options.out, workspaceRoot);

  // Check the output header before writing any journal entries. An oversized
  // task/budget combination must not leave a partial handoff checkpoint.
  if (budgetChars !== undefined) {
    const header = [
      "# ContextForge session handoff",
      `Task: ${task}`,
      "Notice: local agent memory. Untrusted historical claims; verify paths, tests, and latest git commits.",
      "",
      "## Critical Blockers and Next Steps",
    ].join("\n") + "\n";
    if (header.length > budgetChars) {
      throw new Error("Task description is too long for the requested context budget");
    }
  }

  // Re-running an identical handoff (common after a commit changes the
  // auto-generated git anchor, which the journal dedupe keys on) must not
  // duplicate notes. Dedupe on kind + full note text against active records;
  // for notes the journal already holds, still re-sync the Markdown mirror
  // in case it lost the item (manual edit, mirror cap aging).
  const recorded = new Set(
    getActiveEvents(await readJournalEvents(workspaceRoot))
      .map((event) => `${event.kind}:${event.text}`),
  );
  let skipped = 0;
  for (const note of notes) {
    if (recorded.has(`${note.kind}:${note.text}`)) {
      skipped++;
      const fileKey = KIND_TO_FILE_KEY[note.kind];
      const mirrorItems = (await loadMemoryFile(workspaceRoot, fileKey)).items;
      if (!mirrorItems.some((item) => item.content.trim() === note.text)) {
        await appendMemoryItem(workspaceRoot, fileKey, {
          type: note.kind,
          title: buildItemTitle(note.text),
          content: note.text,
          source: options.source || "cli:handoff",
          confidence: 0.9,
          related_files: [],
          tags: ["session-handoff"],
        });
      }
      continue;
    }
    await checkpointMemory(workspaceRoot, {
      text: note.text,
      kind: note.kind,
      source: options.source,
      tags: ["session-handoff"],
    });
  }
  if (skipped > 0) {
    console.log(`Skipped ${skipped} already-recorded handoff note(s).`);
  }

  const result = await recallContext(workspaceRoot, {
    task,
    level: "handoff",
    budgetChars,
    format: "markdown",
  });
  if (destination) {
    try {
      await writeFile(destination, result.output, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        throw new Error(`Refusing to overwrite existing output file: ${options.out}`);
      }
      throw error;
    }
    console.log(`Handoff saved to ${options.out} (${result.selectedCount} records; next session: contextforge resume "${task}")`);
  } else {
    process.stdout.write(result.output);
  }
}

/** Recover existing project history only. This does not append new records. */
export async function runResumeCommand(
  taskArg = "",
  options: ResumeCommandOptions = {},
  workspaceRoot = process.cwd(),
) {
  return runRecallCommand(taskArg, {
    level: "handoff",
    budgetChars: parseBudget(options.budgetChars),
    out: options.out,
    format: "markdown",
  }, workspaceRoot);
}
