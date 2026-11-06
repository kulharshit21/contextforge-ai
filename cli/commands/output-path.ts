import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

// Fail early before journaling if the requested output file is occupied, or if
// its parent path contains a symlink. Final writes still use exclusive-create.
// Shared by `handoff`, `resume`, and `recall --out` so all three apply the same
// output-path safety rules.
export async function validateOutputPath(
  out: string | undefined,
  workspaceRoot: string,
): Promise<string | undefined> {
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
