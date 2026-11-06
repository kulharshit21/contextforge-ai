#!/usr/bin/env node

import { Command } from "commander";

import { runAuditCommand, type AuditCommandOptions } from "./commands/audit";
import { runCapsuleCommand } from "./commands/capsule";
import { runCheckpointCommand, type CheckpointCommandOptions } from "./commands/checkpoint";
import { runDoctorCommand } from "./commands/doctor";
import { runExportCommand } from "./commands/export";
import { runHandoffCommand, runResumeCommand, type HandoffCommandOptions, type ResumeCommandOptions } from "./commands/handoff";
import { runIngestChatCommand } from "./commands/ingest-chat";
import { runInitCommand } from "./commands/init";
import { runRecallCommand, type RecallCommandOptions } from "./commands/recall";
import { runRememberCommand } from "./commands/remember";
import { runRepairCommand, type RepairCommandOptions } from "./commands/repair";
import { runScanCommand } from "./commands/scan";
import {
  runSkillInstallCommand,
  runSkillStatusCommand,
  runSkillUninstallCommand,
  type SkillCommandOptions,
} from "./commands/skill";
import { runStatsCommand } from "./commands/stats";
import { runSyncCommand } from "./commands/sync";
import { runUiCommand } from "./commands/ui";

const program = new Command();

program
  .name("contextforge")
  .description("Local-first AI project memory compiler and persistent context engine")
  .version("0.1.0");

program.command("init").description("Initialize .contextforge memory files and journal").action(() => {
  return runInitCommand();
});

program
  .command("checkpoint")
  .alias("save")
  .description("Save a verified, provenance-backed memory checkpoint")
  .argument("<text>", "concise memory note")
  .option("--kind <kind>", "memory kind (decision, fact, architecture, bug, blocker, next, test, handoff)")
  .option("--source <source>", "verifiable evidence file, commit hash, or issue")
  .option("--tags <tags>", "comma-separated searchable tags")
  .option("--supersedes <id>", "earlier 12-character record ID being corrected")
  .option("--no-sync", "skip synchronizing to structured Markdown memory files")
  .option("--break-lock", "force clear an abandoned writer lock")
  .action((text: string, options: CheckpointCommandOptions) => {
    return runCheckpointCommand(text, options);
  });

program
  .command("recall")
  .description("Restore task-relevant context from local memory within an explicit budget")
  .argument("[task]", "task description for relevance scoring", "")
  .option("--level <level>", "context tier: handoff (compact), capsule (standard), or evidence (full)", "capsule")
  .option("--budget-chars <budget>", "strict character budget for context recovery")
  .option("--format <format>", "output format: markdown or json", "markdown")
  .option("--out <file>", "write restored context to file")
  .action((task: string, options: RecallCommandOptions) => {
    return runRecallCommand(task, options);
  });

program
  .command("handoff")
  .description("Checkpoint verified session progress and produce a budget-bounded next-session handoff")
  .argument("<task>", "task being handed off (1-200 characters)")
  .option("--done <text>", "work completed or important milestone")
  .option("--failed <text>", "failed approach and why it failed")
  .option("--test <text>", "verified test command and result")
  .option("--blocker <text>", "unresolved blocker")
  .option("--next <text>", "next concrete action")
  .option("--source <source>", "evidence reference used by all new notes")
  .option("--budget-chars <budget>", "strict output character budget (default: 1800)")
  .option("--out <file>", "write handoff to a new file (refuses overwrite)")
  .action((task: string, options: HandoffCommandOptions) => runHandoffCommand(task, options));

program
  .command("resume")
  .description("Recover a bounded handoff from the existing local journal without adding records")
  .argument("[task]", "task to resume", "")
  .option("--budget-chars <budget>", "strict output character budget (default: 1800)")
  .option("--out <file>", "write context to a new file (refuses overwrite)")
  .action((task: string, options: ResumeCommandOptions) => runResumeCommand(task, options));

program
  .command("audit")
  .description("Verify append-only journal integrity, active record counts, and markdown memory")
  .option("--verbose", "show kind breakdown and lock status")
  .action((options: AuditCommandOptions) => {
    return runAuditCommand(options);
  });

program
  .command("repair")
  .description("Recover from interrupted writes, truncated logs, or stale writer locks with backup")
  .option("--break-lock", "force clear active writer lock")
  .action((options: RepairCommandOptions) => {
    return runRepairCommand(options);
  });

program
  .command("sync")
  .description("Synchronize structured Markdown memory files with the append-only journal")
  .action(() => {
    return runSyncCommand();
  });

program
  .command("remember")
  .description("Add a durable note to the right memory file and journal")
  .argument("<text>", "memory note")
  .action((text) => runRememberCommand(text));

program
  .command("ingest-chat")
  .description("Read a chat markdown/text file and extract durable project memory")
  .argument("<path>", "path to chat markdown or text file")
  .action((inputPath) => runIngestChatCommand(inputPath));

program.command("scan").description("Scan the current repo and save repo-scan.json").action(() => {
  return runScanCommand();
});

program
  .command("capsule")
  .description("Generate a task-specific context capsule")
  .argument("<task>", "task description")
  .action((task) => runCapsuleCommand(task));

program.command("doctor").description("Detect drift between memory and repo facts").action(() => {
  return runDoctorCommand();
});

program
  .command("export")
  .description("Generate AGENTS.md, CLAUDE.md, GEMINI.md, Cursor rules, Copilot instructions, and memory JSON")
  .option("--all", "Export all agent instruction formats")
  .option("--force", "Replace existing generated agent instruction files")
  .action((options: { force?: boolean }) => runExportCommand(process.cwd(), options));

program.command("stats").description("Show ContextForge workspace stats").action(() => {
  return runStatsCommand();
});

program.command("ui").description("Print dashboard startup instructions").action(() => {
  return runUiCommand();
});

const skillCommand = program
  .command("skill")
  .description("Manage and install the portable Agent Skill across coding agents");

skillCommand
  .command("status")
  .description("Check if the contextforge-memory skill is installed and discoverable")
  .option("--target <dir>", "target project root (defaults to current directory)")
  .option("--global", "check user-global skill directory (~/.agents/skills)")
  .option("--agent <agent>", "coding agent target (standard, antigravity, claude, cursor)")
  .option("--json", "output status report as JSON")
  .action((options: SkillCommandOptions) => {
    return runSkillStatusCommand(options);
  });

skillCommand
  .command("install")
  .description("Install the portable Agent Skill into .agents/skills/contextforge-memory")
  .option("--target <dir>", "target project root (defaults to current directory)")
  .option("--global", "install to user-global skill directory (~/.agents/skills)")
  .option("--agent <agent>", "coding agent target (standard, antigravity, claude, cursor)")
  .option("--force", "overwrite existing installed skill files")
  .action((options: SkillCommandOptions) => {
    return runSkillInstallCommand(options);
  });

skillCommand
  .command("uninstall")
  .description("Remove the installed Agent Skill from .agents/skills/contextforge-memory")
  .option("--target <dir>", "target project root (defaults to current directory)")
  .option("--global", "uninstall from user-global skill directory (~/.agents/skills)")
  .option("--agent <agent>", "coding agent target (standard, antigravity, claude, cursor)")
  .action((options: SkillCommandOptions) => {
    return runSkillUninstallCommand(options);
  });

void program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ContextForge: ${message}`);
  process.exitCode = 1;
});
