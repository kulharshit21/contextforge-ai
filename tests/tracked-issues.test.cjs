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
const CLI = path.join(repoRoot, "bin", "contextforge.js");

function temporaryProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-tracked-fixture-"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "tracked-fixture", scripts: { test: "node --test" } }),
  );
  return root;
}

function runTsxScript(t, scriptName, scriptBody) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-tracked-run-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scriptPath = path.join(root, scriptName);
  fs.writeFileSync(scriptPath, scriptBody);
  return spawnSync(process.execPath, ["--import", tsxImportURL, scriptPath], {
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
}

// Regression coverage for the tracked-issue round:
// - #50: superseding a checkpoint removes the superseded note from the
//   Markdown mirror so the human-facing artifact matches active records.
// - #51: doctor verifies referenced files on disk instead of only checking
//   the narrow scan universe, so valid docs/ anchors are not false-flagged.
const TRACKED_SCRIPT = [
  'import assert from "node:assert/strict";',
  'import fs from "node:fs";',
  'import path from "node:path";',
  'import { pathToFileURL } from "node:url";',
  '',
  'const repoRoot = process.env.CONTEXTFORGE_REPO_ROOT;',
  'const engineUrl = pathToFileURL(path.join(repoRoot, "lib", "memory", "engine.ts")).href;',
  'const { appendMemoryItem, checkpointMemory, initWorkspace, loadMemoryFile, loadMemoryFiles, readRepoScan } = await import(engineUrl);',
  'const { detectMemoryDrift } = await import(pathToFileURL(path.join(repoRoot, "lib", "memory", "drift.ts")).href);',
  '',
  'const root = path.join(process.cwd(), "tracked-ws");',
  'await initWorkspace(root);',
  '',
  '// 1. (#50) Superseding a checkpoint removes the old note from the mirror.',
  'const first = await checkpointMemory(root, { kind: "decision", text: "TRACKED-old-decision use pnpm" });',
  'await checkpointMemory(root, { kind: "decision", text: "TRACKED-new-decision use bun", supersedes: first.event.id });',
  'const decisions = (await loadMemoryFile(root, "DECISIONS")).items.map((item) => item.content);',
  'assert.ok(!decisions.some((content) => content.includes("TRACKED-old-decision")),',
  '  "the superseded note must leave the mirror");',
  'assert.ok(decisions.some((content) => content.includes("TRACKED-new-decision")),',
  '  "the correcting note must be mirrored");',
  '',
  '// 2. (#51) An existing docs/ anchor is not drift; a missing one is.',
  'fs.mkdirSync(path.join(root, "docs"), { recursive: true });',
  'fs.writeFileSync(path.join(root, "docs", "real.md"), "# real");',
  'await appendMemoryItem(root, "PROJECT_STATE", { type: "fact", title: "Paths",',
  '  content: "TRACKED-paths body", source: "cli:probe", confidence: 0.9,',
  '  related_files: ["docs/real.md", "docs/gone.md"], tags: [] });',
  'const scan = await readRepoScan(root);',
  'const drift = detectMemoryDrift(root, await loadMemoryFiles(root), scan);',
  'assert.ok(drift.some((issue) => issue.title.includes("docs/gone.md")),',
  '  "a missing file must still be flagged");',
  'assert.ok(!drift.some((issue) => issue.title.includes("docs/real.md")),',
  '  "an existing file on disk must not be flagged");',
  '',
  'console.log("tracked-issue checks passed");',
].join("\n");

test("#50/#51: supersedes cleans the mirror and doctor verifies paths on disk", (t) => {
  const result = runTsxScript(t, "tracked.mts", TRACKED_SCRIPT);
  assert.equal(result.status, 0,
    "tracked-issue script failed:\n" + result.stdout + "\n" + result.stderr);
  assert.match(result.stdout, /tracked-issue checks passed/);
});

test("#65: torn skill installs recover under --force and uninstall cleans them", (t) => {
  const root = temporaryProject();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8", timeout: 120000 });
  const dest = path.join(root, ".agents", "skills", "contextforge-memory");
  const sourceScript = fs.readFileSync(
    path.join(repoRoot, ".agents", "skills", "contextforge-memory", "scripts", "contextforge_memory.py"),
    "utf8",
  );

  // Simulate a crash mid-copy: byte-prefixes of the source files, no manifest.
  const sourceSkill = fs.readFileSync(
    path.join(repoRoot, ".agents", "skills", "contextforge-memory", "SKILL.md"),
    "utf8",
  );
  fs.mkdirSync(path.join(dest, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(dest, "SKILL.md"), sourceSkill.slice(0, 30));
  fs.writeFileSync(path.join(dest, "scripts", "contextforge_memory.py"), sourceScript.slice(0, 4000));

  const blocked = run("skill", "install");
  assert.notEqual(blocked.status, 0, "install without --force must still refuse");

  const recovered = run("skill", "install", "--force");
  assert.equal(recovered.status, 0,
    "torn install must be recoverable with --force:\n" + recovered.stderr);
  assert.match(recovered.stdout, /ContextForge Agent Skill Installed/);
  assert.match(fs.readFileSync(path.join(dest, "scripts", "contextforge_memory.py"), "utf8"), /def main/);

  // Torn shape again: uninstall cleans it without a manifest.
  fs.rmSync(path.join(dest, ".contextforge-install.json"), { force: true });
  fs.writeFileSync(path.join(dest, "scripts", "contextforge_memory.py"), sourceScript.slice(0, 2000));
  const uninstalled = run("skill", "uninstall");
  assert.equal(uninstalled.status, 0,
    "torn install must be cleanable by uninstall:\n" + uninstalled.stderr);
  assert.equal(fs.existsSync(dest), false);
});

test("#52: remember reports duplicates honestly and recall validates --format", (t) => {
  const root = temporaryProject();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8", timeout: 120000 });
  run("init");
  const first = run("remember", "Honesty-probe note about retries");
  assert.match(first.stdout, /Saved note to/);
  const second = run("remember", "Honesty-probe note about retries");
  assert.match(second.stdout, /Duplicate not saved/, "duplicate remember must not claim Saved");
  const badFormat = run("recall", "--format", "xml");
  assert.notEqual(badFormat.status, 0);
  assert.match(badFormat.stderr, /Invalid format/);
});
