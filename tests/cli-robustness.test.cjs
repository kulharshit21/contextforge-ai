/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const tsxImportURL = pathToFileURL(require.resolve("tsx", { paths: [repoRoot] })).href;

// Regression coverage for the CLI robustness round: shared output-path
// validation (recall/resume --out), handoff rerun de-duplication, audit
// tolerance for unreadable memory files, ingest mirror idempotence, projects
// index tolerance, ghost-capsule skipping, corrupt repo-scan fallback, and
// chat-extraction provider fallback.
const ROBUSTNESS_SCRIPT = [
  'import assert from "node:assert/strict";',
  'import fs from "node:fs";',
  'import os from "node:os";',
  'import path from "node:path";',
  'import { pathToFileURL } from "node:url";',
  '',
  'const repoRoot = process.env.CONTEXTFORGE_REPO_ROOT;',
  'const engineUrl = pathToFileURL(path.join(repoRoot, "lib", "memory", "engine.ts")).href;',
  'const journalUrl = pathToFileURL(path.join(repoRoot, "lib", "memory", "journal.ts")).href;',
  'const recallUrl = pathToFileURL(path.join(repoRoot, "cli", "commands", "recall.ts")).href;',
  'const handoffUrl = pathToFileURL(path.join(repoRoot, "cli", "commands", "handoff.ts")).href;',
  'const projectsUrl = pathToFileURL(path.join(repoRoot, "lib", "server", "projects.ts")).href;',
  'const aiUrl = pathToFileURL(path.join(repoRoot, "lib", "ai", "index.ts")).href;',
  '',
  'const { initWorkspace, listSavedCapsules, readRepoScan, saveCapsule } = await import(engineUrl);',
  'const { readJournalEvents } = await import(journalUrl);',
  'const { runRecallCommand } = await import(recallUrl);',
  'const { runHandoffCommand } = await import(handoffUrl);',
  'const { listProjects } = await import(projectsUrl);',
  'const { extractMemoryFromChat } = await import(aiUrl);',
  '',
  'const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-robustness-"));',
  'const root = path.join(scratch, "proj");',
  'await initWorkspace(root);',
  '',
  '// 1. recall/resume --out refuses symlink escapes out of the project',
  '//    (same rule handoff --out already enforced).',
  'const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-robust-out-"));',
  'fs.mkdirSync(path.join(outsideDir, "deep"), { recursive: true });',
  'await initWorkspace(root);',
  'fs.writeFileSync(path.join(root, "seed.md"), "seed");',
  'const { checkpointMemory } = await import(engineUrl);',
  'await checkpointMemory(root, { kind: "next", text: "ROBUSTNESS-resume-note" });',
  'const junction = path.join(root, "rob-junction");',
  'fs.symlinkSync(outsideDir, junction, process.platform === "win32" ? "junction" : "dir");',
  'await assert.rejects(',
  '  () => runRecallCommand("ROBUSTNESS-resume-note", { level: "handoff", out: path.join("rob-junction", "deep", "escaped.md") }, root),',
  '  /Refusing output path outside project through symlink/,',
  ');',
  'assert.equal(fs.existsSync(path.join(outsideDir, "deep", "escaped.md")), false,',
  '  "no file may be written outside the project via a junction");',
  '',
  '// 2. Re-running an identical handoff does not duplicate journal notes.',
  'await runHandoffCommand("Robustness task", { next: "ROBUSTNESS-next-action", done: "ROBUSTNESS-done-item" }, root);',
  'const beforeRerun = (await readJournalEvents(root)).filter((e) => e.text.includes("ROBUSTNESS-")).length;',
  'await runHandoffCommand("Robustness task", { next: "ROBUSTNESS-next-action", done: "ROBUSTNESS-done-item" }, root);',
  'const afterRerun = (await readJournalEvents(root)).filter((e) => e.text.includes("ROBUSTNESS-")).length;',
  'assert.equal(afterRerun, beforeRerun, "identical handoff rerun must not add journal records");',
  '',
  '// 3. Audit survives an unreadable memory file and still reports the journal.',
  'const brokenDir = path.join(root, ".contextforge", "BUGS_AND_FIXES.md");',
  'fs.rmSync(brokenDir, { recursive: true, force: true });',
  'fs.mkdirSync(brokenDir);',
  'const { auditAllMemory } = await import(engineUrl);',
  'const audited = await auditAllMemory(root);',
  'assert.ok(audited.markdown.errors.some((e) => e.startsWith("BUGS_AND_FIXES")),',
  '  "the unreadable file must be reported");',
  'assert.ok(audited.journal.isValid, "journal verdict must survive mirror breakage");',
  'fs.rmSync(brokenDir, { recursive: true, force: true });',
  '',
  '// 4. Re-ingesting the same chat content does not duplicate mirror entries.',
  'const { mergeExtractedMemory } = await import(engineUrl);',
  'const ingestPayload = {',
  '  decisions: [{ title: "Ingest once", content: "ROBUSTNESS-ingest-content", confidence: 0.9, related_files: [], tags: [], source: "chat-ingest:probe" }],',
  '};',
  'const { loadMemoryFile } = await import(engineUrl);',
  'await mergeExtractedMemory(root, ingestPayload, "chat-ingest:probe");',
  'const mirrorAfterFirst = (await loadMemoryFile(root, "DECISIONS")).items.filter((i) => i.content === "ROBUSTNESS-ingest-content").length;',
  'await mergeExtractedMemory(root, ingestPayload, "chat-ingest:probe");',
  'const mirrorAfterSecond = (await loadMemoryFile(root, "DECISIONS")).items.filter((i) => i.content === "ROBUSTNESS-ingest-content").length;',
  'assert.equal(mirrorAfterFirst, 1);',
  'assert.equal(mirrorAfterSecond, 1, "re-ingest must not duplicate mirror entries");',
  '',
  '// 5. One invalid record in projects.json does not hide the valid ones.',
  'const { readJsonIfExists, writeJsonPretty } = await import(pathToFileURL(path.join(repoRoot, "lib", "utils", "fs.ts")).href);',
  'const indexPath = path.join(process.cwd(), "workspaces", "projects.json");',
  'await listProjects(); // bootstrap the index with the starter project',
  'const stored = await readJsonIfExists(indexPath);',
  'stored.projects.push({ id: "broken-record", name: "Broken" });',
  'await writeJsonPretty(indexPath, stored);',
  'const projects = await listProjects();',
  'assert.ok(projects.some((p) => p.id === "broken-record") === false, "invalid record must be skipped");',
  'assert.ok(projects.some((p) => p.id === "starter-local"), "valid records must survive");',
  '',
  '// 6. Ghost capsule files (no frontmatter) are skipped.',
  'const capsuleRoot = path.join(process.cwd(), "ghost-capsules-ws");',
  'await initWorkspace(capsuleRoot);',
  'await saveCapsule(capsuleRoot, "Real capsule", {',
  '  goal: "g", summary: "s", relevant_context: [], files_likely_needed: [], files_to_avoid: [],',
  '  previous_errors_to_remember: [], commands_to_run: [], agent_prompt: "p",',
  '  estimated_raw_tokens: 1, estimated_capsule_tokens: 1, saved_percent: 0,',
  '});',
  'fs.writeFileSync(path.join(capsuleRoot, ".contextforge", "CAPSULES", "ghost.md"), "just some stray text\\n");',
  'fs.writeFileSync(path.join(capsuleRoot, ".contextforge", "CAPSULES", "empty.md"), "");',
  'const capsules = await listSavedCapsules(capsuleRoot);',
  'assert.equal(capsules.length, 1, "ghost and empty capsule files must be skipped");',
  '',
  '// 7. A corrupt repo-scan.json degrades to a default scan instead of failing.',
  'const scanRoot = path.join(process.cwd(), "scan-tolerance-ws");',
  'await initWorkspace(scanRoot);',
  'fs.writeFileSync(path.join(scanRoot, ".contextforge", "repo-scan.json"), "{ not json !!!");',
  'const degradedScan = await readRepoScan(scanRoot);',
  'assert.equal(degradedScan.framework, "unknown", "corrupt scan must fall back to defaults");',
  '',
  '// 8. Chat extraction falls back to deterministic heuristics when the',
  '//    configured provider is unreachable.',
  'process.env.OLLAMA_BASE_URL = "http://127.0.0.1:9";',
  'process.env.CONTEXTFORGE_PRIVACY_MODE = "local";',
  'const extraction = await extractMemoryFromChat(',
  '  "We decided to use SQLite for the local cache while preparing the project.",',
  '  "Full extraction",',
  '  "ollama",',
  ');',
  'assert.match(extraction.provider.warning || "", /Provider call failed/);',
  'assert.ok(',
  '  JSON.stringify(extraction.extracted).includes("SQLite") ||',
  '    JSON.stringify(extraction.extracted).includes("sqlite"),',
  '  "heuristic fallback must still extract the decision",',
  ');',
  '',
  'console.log("cli robustness checks passed");',
].join("\n");

test("cli robustness: output-path parity, handoff dedupe, audit/ingest/index/scan tolerance, provider fallback", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-robustness-run-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scriptPath = path.join(root, "robustness.mts");
  fs.writeFileSync(scriptPath, ROBUSTNESS_SCRIPT);
  const result = spawnSync(process.execPath, ["--import", tsxImportURL, scriptPath], {
    cwd: root,
    encoding: "utf8",
    timeout: 240000,
    env: {
      ...process.env,
      CONTEXTFORGE_REPO_ROOT: repoRoot,
      CONTEXTFORGE_AI_PROVIDER: "mock",
      CONTEXTFORGE_PRIVACY_MODE: "local",
      TSX_TSCONFIG_PATH: path.join(repoRoot, "tsconfig.json"),
    },
  });
  assert.equal(result.status, 0,
    "cli robustness script failed:\n" + result.stdout + "\n" + result.stderr);
  assert.match(result.stdout, /cli robustness checks passed/);
});
