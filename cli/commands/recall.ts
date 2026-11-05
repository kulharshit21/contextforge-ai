import { writeFile } from "node:fs/promises";
import { recallContext } from "@/lib/memory/engine";
import { type ContextLevel, CONTEXT_LEVELS } from "@/lib/memory/schemas";

export type RecallCommandOptions = {
  task?: string;
  level?: string;
  budgetChars?: string | number;
  format?: string;
  out?: string;
};

export async function runRecallCommand(
  taskArg?: string,
  options: RecallCommandOptions = {},
  workspaceRoot = process.cwd(),
) {
  const task = taskArg || options.task || "";
  let level: ContextLevel = "capsule";
  if (options.level) {
    const normalized = options.level.toLowerCase() as ContextLevel;
    if (!CONTEXT_LEVELS.includes(normalized)) {
      throw new Error(
        `Invalid level: '${options.level}'. Must be one of: ${CONTEXT_LEVELS.join(", ")}`,
      );
    }
    level = normalized;
  }

  const budgetChars = options.budgetChars ? Number(options.budgetChars) : undefined;
  const format = options.format === "json" ? "json" : "markdown";

  const result = await recallContext(workspaceRoot, {
    task,
    level,
    budgetChars,
    format,
  });

  if (options.out) {
    await writeFile(options.out, result.output, "utf8");
    console.log(`Saved ${result.selectedCount} records to ${options.out} (${result.level} level)`);
  } else {
    process.stdout.write(result.output);
  }
}
