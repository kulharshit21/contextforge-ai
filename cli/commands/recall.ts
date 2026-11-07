import { writeFile } from "node:fs/promises";
import { recallContext } from "../../lib/memory/engine";
import { type ContextLevel, CONTEXT_LEVELS } from "../../lib/memory/schemas";

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
  if (options.format !== undefined && !["markdown", "json"].includes(options.format)) {
    throw new Error(
      `Invalid format: '${options.format}'. Must be one of: markdown, json`,
    );
  }
  const format = options.format === "json" ? "json" : "markdown";

  const result = await recallContext(workspaceRoot, {
    task,
    level,
    budgetChars,
    format,
  });

  if (options.out) {
    try {
      // Exclusive create prevents recall from clobbering existing project files.
      await writeFile(options.out, result.output, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        throw new Error(`Refusing to overwrite existing output file: ${options.out}`);
      }
      throw error;
    }
    console.log(`Saved ${result.selectedCount} records to ${options.out} (${result.level} level)`);
  } else {
    process.stdout.write(result.output);
  }
}
