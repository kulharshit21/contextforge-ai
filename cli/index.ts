#!/usr/bin/env node

import { Command } from "commander";

import { runCapsuleCommand } from "./commands/capsule";
import { runDoctorCommand } from "./commands/doctor";
import { runExportCommand } from "./commands/export";
import { runIngestChatCommand } from "./commands/ingest-chat";
import { runInitCommand } from "./commands/init";
import { runRememberCommand } from "./commands/remember";
import { runScanCommand } from "./commands/scan";
import { runStatsCommand } from "./commands/stats";
import { runUiCommand } from "./commands/ui";

const program = new Command();

program
  .name("contextforge")
  .description("Local-first AI project memory compiler")
  .version("0.1.0");

program.command("init").description("Initialize .contextforge memory files").action(() => {
  return runInitCommand();
});

program
  .command("remember")
  .description("Add a durable note to the right memory file")
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
  .option("--all", "ignored for MVP parity; all exports are always generated")
  .action(() => runExportCommand());

program.command("stats").description("Show ContextForge workspace stats").action(() => {
  return runStatsCommand();
});

program.command("ui").description("Print dashboard startup instructions").action(() => {
  return runUiCommand();
});

program.parseAsync(process.argv);
