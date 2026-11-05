import { spawnSync } from "node:child_process";
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
  const installed = skillMdExists && scriptExists;

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
  console.log(`Installed: ${status.installed ? "Yes" : "No"}`);
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
    console.log("\nSkill is discoverable by compatible coding agents (Codex, Antigravity, Claude Code, Cursor).");
    console.log("Prompt your agent: 'Use the contextforge-memory skill to recall relevant project context.'");
  }
}

export async function runSkillInstallCommand(options: SkillCommandOptions) {
  const sourceDir = resolveSkillSourceDir();
  const destDir = resolveSkillDestDir(options);

  const skillMdDest = path.join(destDir, "SKILL.md");
  if ((await pathExists(skillMdDest)) && !options.force) {
    console.error(`ContextForge skill is already installed at ${destDir}. Use --force to overwrite.`);
    process.exitCode = 1;
    return;
  }

  await ensureDir(destDir);
  await ensureDir(path.join(destDir, "scripts"));
  await ensureDir(path.join(destDir, "references"));

  fs.copyFileSync(path.join(sourceDir, "SKILL.md"), skillMdDest);
  const scriptDest = path.join(destDir, "scripts", "contextforge_memory.py");
  fs.copyFileSync(path.join(sourceDir, "scripts", "contextforge_memory.py"), scriptDest);

  const refSrc = path.join(sourceDir, "references", "design.md");
  if (fs.existsSync(refSrc)) {
    fs.copyFileSync(refSrc, path.join(destDir, "references", "design.md"));
  }

  try {
    fs.chmodSync(scriptDest, 0o755);
  } catch {
    // Windows chmod may be a no-op
  }

  console.log("=== ContextForge Agent Skill Installed ===");
  console.log(`Location: ${destDir}`);
  console.log("Files copied:");
  console.log("  - SKILL.md (metadata and agent prompt instructions)");
  console.log("  - scripts/contextforge_memory.py (portable standard-library memory engine)");
  console.log("  - references/design.md (memory contract and schemas)");
  console.log("\nNext steps:");
  console.log("  1. Ask your agent: \"Use the contextforge-memory skill to recall context for this task\"");
  console.log("  2. Or run offline memory commands directly:");
  console.log(`     python "${scriptDest}" --root . init`);
  console.log(`     python "${scriptDest}" --root . recall --task "my task"`);
}

export async function runSkillUninstallCommand(options: SkillCommandOptions) {
  const destDir = resolveSkillDestDir(options);

  if (!(await pathExists(destDir))) {
    console.log(`No skill installation found at ${destDir}`);
    return;
  }

  fs.rmSync(destDir, { recursive: true, force: true });

  try {
    const skillsDir = path.dirname(destDir);
    if (fs.existsSync(skillsDir) && fs.readdirSync(skillsDir).length === 0) {
      fs.rmdirSync(skillsDir);
      const agentsDir = path.dirname(skillsDir);
      if (fs.existsSync(agentsDir) && fs.readdirSync(agentsDir).length === 0) {
        fs.rmdirSync(agentsDir);
      }
    }
  } catch {
    // Ignore cleanup errors on non-empty dirs
  }

  console.log(`ContextForge Agent Skill uninstalled from ${destDir}`);
}
