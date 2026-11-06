import { lstat, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import { checkpointMemory, recallContext } from "../../lib/memory/engine";
import { refuseSensitive } from "../../lib/memory/journal";
import type { JournalEventKind } from "../../lib/memory/schemas";
import { runRecallCommand } from "./recall";

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
async function validateOutputPath(out: string | undefined, workspaceRoot: string): Promise<string | undefined> {
  if (!out) return undefined;
  const target = path.resolve(workspaceRoot, out);
  const parent = path.dirname(target);
  const parentInfo = await lstat(parent);
  if (!parentInfo.isDirectory()) {
    throw new Error(`Output parent is not a directory: ${parent}`);
  }
  // Compare canonical paths instead of rejecting system-level symlinks such
  // as macOS /var -> /private/var. Internal project symlink escapes are still refused.
  const lexicalRelative = path.relative(path.resolve(workspaceRoot), target);
  const intendedInside = lexicalRelative !== ".."
    && !lexicalRelative.startsWith(".." + path.sep)
    && !path.isAbsolute(lexicalRelative);
  if (intendedInside) {
    const [realRoot, realParent] = await Promise.all([
      realpath(workspaceRoot),
      realpath(parent),
    ]);
    const relative = path.relative(realRoot, realParent);
    if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
      throw new Error(`Refusing output path outside project through symlink: ${out}`);
    }
  }
  try {
    await lstat(target);
    throw new Error(`Refusing to overwrite existing output file: ${out}`);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  return target;
}

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

  for (const note of notes) {
    await checkpointMemory(workspaceRoot, {
      text: note.text,
      kind: note.kind,
      source: options.source,
      tags: ["session-handoff"],
    });
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
