import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(targetPath: string) {
  await mkdir(targetPath, { recursive: true });
}

export async function readTextIfExists(targetPath: string) {
  if (!(await pathExists(targetPath))) {
    return null;
  }

  return readFile(targetPath, "utf8");
}

export async function readJsonIfExists<T>(targetPath: string) {
  const content = await readTextIfExists(targetPath);
  return content ? (JSON.parse(content) as T) : null;
}

export async function writeJsonPretty(targetPath: string, value: unknown) {
  await ensureDir(path.dirname(targetPath));
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
