import { writeFile } from "node:fs/promises";
import { recallContext } from "../../lib/memory/engine";
import { type ContextLevel, CONTEXT_LEVELS } from "../../lib/memory/schemas";
import { validateOutputPath } from "./output-path";

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
    // Same output-path rules as `handoff --out`: exclusive create, no existing
    // file, no symlink escape out of the project. Validate before writing.
    const destination = await validateOutputPath(options.out, workspaceRoot);
    if (!destination) {
      throw new Error("Output path was not provided");
    }
    try {
      await writeFile(destination, result.output, { encoding: "utf8", flag: "wx" });
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
