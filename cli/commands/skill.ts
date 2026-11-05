import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ensureDir, pathExists } from "../../lib/utils/fs";
import { getEventsPath } from "../../lib/memory/journal";

export interface SkillCommandOptions {
  target?: string;
  global?: boolean;
  agent?: string;
  force?: boolean;
  json?: boolean;
}

export interface SkillStatusResult {
  installed: boolean;
  location: string;
  scope: "project" | "global";
  agent: string;
  files: {
    skillMd: boolean;
    script: boolean;
    reference: boolean;
  };
  skillName?: string;
  managedInstallation?: boolean;
  pythonRuntime?: {
    available: boolean;
    command: string;
    version?: string;
  };
  journalStatus?: {
    initialized: boolean;
    eventsPath: string;
    exists: boolean;
  };
}


const INSTALL_MANIFEST = ".contextforge-install.json";
const INSTALLED_FILES = ["SKILL.md", "scripts/contextforge_memory.py", "references/design.md"] as const;
type InstallManifest = { version: 1; files: Record<string, string> };

function assertNoSymlinks(input: string) {
  let current = path.resolve(input);
  for (;;) {
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error("Refusing to operate through symlink: " + current);
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
function fileHash(filename: string) {
  return createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}
function assertManagedAndUnmodified(dir: string) {
  const manifestPath = path.join(dir, INSTALL_MANIFEST);
  assertNoSymlinks(manifestPath);
  let manifest: InstallManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as InstallManifest;
  } catch {
    throw new Error("Refusing to modify legacy/manual skill installation without a valid ContextForge manifest.");
  }
  if (manifest.version !== 1 || !manifest.files ||
      JSON.stringify(Object.keys(manifest.files).sort()) !== JSON.stringify([...INSTALLED_FILES].sort())) {
    throw new Error("Refusing to modify an unknown ContextForge installation manifest.");
  }
  for (const [location, names] of [
    [dir, [INSTALL_MANIFEST, "SKILL.md", "scripts", "references"]],
    [path.join(dir, "scripts"), ["contextforge_memory.py"]],
    [path.join(dir, "references"), ["design.md"]],
  ] as const) {
    assertNoSymlinks(location);
    if (JSON.stringify(fs.readdirSync(location).sort()) !== JSON.stringify([...names].sort())) {
      throw new Error("Refusing to modify skill directory containing additional or unexpected files.");
    }
  }
  for (const relative of INSTALLED_FILES) {
    const filename = path.join(dir, relative);
    assertNoSymlinks(filename);
    if (!fs.statSync(filename).isFile() || fileHash(filename) !== manifest.files[relative]) {
      throw new Error("Refusing to modify changed skill file: " + relative);
    }
  }
}

export function resolveSkillSourceDir(): string {
  const candidate = path.resolve(__dirname, "..", "..", ".agents", "skills", "contextforge-memory");
  if (fs.existsSync(path.join(candidate, "SKILL.md"))) {
    return candidate;
  }
  let curr = process.cwd();
  while (curr && curr !== path.dirname(curr)) {
    const check = path.join(curr, ".agents", "skills", "contextforge-memory");
    if (fs.existsSync(path.join(check, "SKILL.md"))) {
      return check;
    }
    curr = path.dirname(curr);
  }
  throw new Error("Could not find contextforge-memory skill source in package distribution.");
}

export function resolveSkillDestDir(options: SkillCommandOptions): string {
  const agent = (options.agent || "standard").toLowerCase();
  const isGlobal = Boolean(options.global);
  const baseDir = isGlobal
    ? os.homedir()
    : options.target
      ? path.resolve(options.target)
      : process.cwd();

  switch (agent) {
    case "antigravity":
      return isGlobal
        ? path.join(baseDir, ".gemini", "antigravity", "builtin", "skills", "contextforge-memory")
        : path.join(baseDir, ".gemini", "skills", "contextforge-memory");
    case "claude":
      return path.join(baseDir, ".claude", "skills", "contextforge-memory");
    case "cursor":
      return path.join(baseDir, ".cursor", "skills", "contextforge-memory");
    case "agents":
    case "standard":
    default:
      return path.join(baseDir, ".agents", "skills", "contextforge-memory");
  }
}

export function detectPythonRuntime(): { available: boolean; command: string; version?: string } {
  for (const cmd of ["python3", "python"]) {
    try {
      const res = spawnSync(cmd, ["--version"], { encoding: "utf8" });
      if (res.status === 0) {
        const out = (res.stdout || res.stderr || "").trim();
        return { available: true, command: cmd, version: out };
      }
    } catch {
      // Continue to next candidate
    }
  }
  return { available: false, command: "none" };
}

export async function checkSkillStatus(options: SkillCommandOptions): Promise<SkillStatusResult> {
  const destDir = resolveSkillDestDir(options);
  const isGlobal = Boolean(options.global);
  const agent = (options.agent || "standard").toLowerCase();

  const skillMdPath = path.join(destDir, "SKILL.md");
  const scriptPath = path.join(destDir, "scripts", "contextforge_memory.py");
  const refPath = path.join(destDir, "references", "design.md");

  const skillMdExists = await pathExists(skillMdPath);
  const scriptExists = await pathExists(scriptPath);
  const refExists = await pathExists(refPath);
  const installed = skillMdExists && scriptExists && refExists;

  let skillName: string | undefined = undefined;
  if (skillMdExists) {
    try {
      const content = fs.readFileSync(skillMdPath, "utf8");
      const nameMatch = /^name:\s*([a-z0-9_-]+)/m.exec(content);
      if (nameMatch) {
        skillName = nameMatch[1];
      }
    } catch {
      // Ignore read errors
    }
  }

  const python = detectPythonRuntime();
  const workspaceRoot = isGlobal ? os.homedir() : options.target ? path.resolve(options.target) : process.cwd();
  const eventsPath = getEventsPath(workspaceRoot);
  const journalExists = await pathExists(eventsPath);

  return {
    installed,
    location: destDir,
    scope: isGlobal ? "global" : "project",
    agent,
    files: {
      skillMd: skillMdExists,
      script: scriptExists,
      reference: refExists,
    },
    skillName,
    managedInstallation: await pathExists(path.join(destDir, INSTALL_MANIFEST)),
    pythonRuntime: python,
    journalStatus: {
      initialized: journalExists,
      eventsPath,
      exists: journalExists,
    },
  };
}

export async function runSkillStatusCommand(options: SkillCommandOptions) {
  const status = await checkSkillStatus(options);

  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log("=== ContextForge Agent Skill Status ===");
  console.log(`Scope:     ${status.scope === "global" ? "User-global (~/.agents/skills)" : "Project-local (.agents/skills)"}`);
  console.log(`Location:  ${status.location}`);
  console.log(`Agent:     ${status.agent}`);
  console.log(`Installed: ${status.installed ? "Files present" : "No"}`);
  console.log(`Managed:   ${status.managedInstallation ? "Manifest present" : "No manifest"}`);
  console.log(`Files:`);
  console.log(`  - SKILL.md:                      ${status.files.skillMd ? "present" : "missing"}`);
  console.log(`  - scripts/contextforge_memory.py: ${status.files.script ? "present" : "missing"}`);
  console.log(`  - references/design.md:          ${status.files.reference ? "present" : "missing"}`);

  if (status.pythonRuntime) {
    console.log(`Python:    ${status.pythonRuntime.available ? `${status.pythonRuntime.command} (${status.pythonRuntime.version})` : "Not detected on PATH"}`);
  }

  if (status.journalStatus) {
    console.log(`Journal:   ${status.journalStatus.exists ? "Initialized (.contextforge/agent-memory/events.jsonl)" : "Not initialized (run `contextforge init`)"}`);
  }

  if (!status.installed) {
    console.log("\nTo install the skill in this project, run:");
    console.log("  contextforge skill install");
  } else {
    console.log("\nSkill files are present. Verify discovery in the target agent; filesystem presence alone does not guarantee activation.");
    console.log("Prompt your agent: 'Use the contextforge-memory skill to recall relevant project context.'");
  }
}

export async function runSkillInstallCommand(options: SkillCommandOptions) {
  const sourceDir = resolveSkillSourceDir();
  const destDir = resolveSkillDestDir(options);
  assertNoSymlinks(destDir);
  if (path.resolve(sourceDir) === path.resolve(destDir)) {
    throw new Error("Cannot install skill over its own source directory.");
  }
  if (fs.existsSync(destDir)) {
    if (!fs.statSync(destDir).isDirectory()) throw new Error("Skill destination is not a directory.");
    if (fs.readdirSync(destDir).length > 0) {
      if (!options.force) {
        console.error("Skill directory already contains files at " + destDir + ". Use --force for an unmodified ContextForge-managed installation.");
        process.exitCode = 1;
        return;
      }
      assertManagedAndUnmodified(destDir);
    }
  }
  for (const relative of INSTALLED_FILES) {
    const from = path.join(sourceDir, relative);
    if (!fs.existsSync(from) || !fs.statSync(from).isFile()) {
      throw new Error("Incomplete skill distribution: " + relative);
    }
    assertNoSymlinks(path.join(destDir, relative));
  }
  assertNoSymlinks(path.join(destDir, INSTALL_MANIFEST));
  await ensureDir(destDir);
  const hashes: Record<string, string> = {};
  for (const relative of INSTALLED_FILES) {
    const target = path.join(destDir, relative);
    await ensureDir(path.dirname(target));
    fs.copyFileSync(path.join(sourceDir, relative), target);
    hashes[relative] = fileHash(target);
  }
  const scriptDest = path.join(destDir, "scripts", "contextforge_memory.py");
  try {
    fs.chmodSync(scriptDest, 0o755);
  } catch {
    // Windows chmod may be a no-op
  }
  fs.writeFileSync(path.join(destDir, INSTALL_MANIFEST), JSON.stringify({
    version: 1, files: hashes
  } satisfies InstallManifest, null, 2) + "\n", "utf8");

  console.log("=== ContextForge Agent Skill Installed ===");
  console.log("Location: " + destDir);
  console.log("Files copied:");
  console.log("  - SKILL.md (metadata and agent prompt instructions)");
  console.log("  - scripts/contextforge_memory.py (portable standard-library memory engine)");
  console.log("  - references/design.md (memory contract and schemas)");
  console.log("\nNext steps:");
  console.log('  1. Ask your agent: "Use the contextforge-memory skill to recall context for this task"');
  console.log("  2. Or run offline memory commands directly:");
  console.log('     python "' + scriptDest + '" --root . init');
  console.log('     python "' + scriptDest + '" --root . recall --task "my task"');
  console.log("  3. Verify actual skill discovery in your agent.");
}

export async function runSkillUninstallCommand(options: SkillCommandOptions) {
  const destDir = resolveSkillDestDir(options);
  assertNoSymlinks(destDir);
  if (!fs.existsSync(destDir)) {
    console.log("No skill installation found at " + destDir);
    return;
  }
  if (!fs.statSync(destDir).isDirectory()) {
    throw new Error("Uninstall refused: target is not a directory.");
  }
  assertManagedAndUnmodified(destDir);
  for (const relative of INSTALLED_FILES) fs.unlinkSync(path.join(destDir, relative));
  fs.unlinkSync(path.join(destDir, INSTALL_MANIFEST));
  fs.rmdirSync(path.join(destDir, "scripts"));
  fs.rmdirSync(path.join(destDir, "references"));
  fs.rmdirSync(destDir);
  // Remove only empty parent directories, never siblings or project data.
  const parent = path.dirname(destDir);
  const outer = path.dirname(parent);
  for (const dirname of [parent, outer]) {
    if (fs.existsSync(dirname) && fs.readdirSync(dirname).length === 0) fs.rmdirSync(dirname);
  }
  console.log("ContextForge Agent Skill uninstalled from " + destDir);
}
