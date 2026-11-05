/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const CLI = path.resolve(__dirname, "..", "bin", "contextforge.js");
const PYTHON_SCRIPT = path.resolve(
  __dirname,
  "..",
  ".agents",
  "skills",
  "contextforge-memory",
  "scripts",
  "contextforge_memory.py",
);

function temporaryProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    name: "contextforge-integration-fixture",
    scripts: { test: "node --test" },
  }));
  fs.writeFileSync(path.join(root, "README.md"), "# Test fixture\n");
  return root;
}

function runCli(root, ...args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
    env: {
      ...process.env,
      CONTEXTFORGE_AI_PROVIDER: "mock",
      CONTEXTFORGE_PRIVACY_MODE: "local",
    },
  });
}

function checkedCli(root, ...args) {
  const result = runCli(root, ...args);
  assert.equal(result.status, 0,
    "contextforge " + args.join(" ") + " failed:\n" + result.stdout + "\n" + result.stderr);
  return result.stdout;
}

function runPython(root, ...args) {
  return spawnSync(process.platform === "win32" ? "python" : "python3", [
    PYTHON_SCRIPT,
    "--root",
    root,
    ...args,
  ], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });
}

test("initialization is idempotent, and memory notes persist", (t) => {
  const root = temporaryProject(t);
  checkedCli(root, "init");
  const memoryRoot = path.join(root, ".contextforge");
  for (const name of ["PROJECT_STATE", "DECISIONS", "ARCHITECTURE", "BUGS_AND_FIXES", "CURRENT_TASKS"]) {
    assert.ok(fs.existsSync(path.join(memoryRoot, name + ".md")), name + " missing");
  }
  checkedCli(root, "remember", "We decided to preserve local memory without paid APIs.");
  const before = fs.readFileSync(path.join(memoryRoot, "DECISIONS.md"), "utf8");
  assert.match(before, /preserve local memory/);
  checkedCli(root, "init");
  assert.equal(fs.readFileSync(path.join(memoryRoot, "DECISIONS.md"), "utf8"), before);
});

test("scan, capsule, doctor, stats, and agent exports work offline", (t) => {
  const root = temporaryProject(t);
  fs.writeFileSync(path.join(root, ".env.local"), "PRIVATE_KEY=must-not-appear\n");
  checkedCli(root, "init");
  checkedCli(root, "scan");
  const scan = JSON.parse(fs.readFileSync(path.join(root, ".contextforge/repo-scan.json"), "utf8"));
  assert.equal(scan.package_manager, "npm");
  assert.ok(!scan.files_inspected.includes(".env.local"), "secret env file must not be scanned");
  checkedCli(root, "capsule", "Document setup and avoid old bugs");
  checkedCli(root, "capsule", "Document setup and avoid old bugs");
  const capsules = fs.readdirSync(path.join(root, ".contextforge/CAPSULES")).filter((n) => n.endsWith(".md"));
  assert.equal(capsules.length, 2, "capsules for identical tasks must not overwrite each other");
  checkedCli(root, "doctor");
  assert.match(checkedCli(root, "stats"), /Capsules generated: 2/);
  checkedCli(root, "export", "--all");
  for (const name of ["AGENTS.md", "CLAUDE.md", "GEMINI.md", "CONTEXTFORGE_CAPSULE.md"]) {
    assert.ok(fs.existsSync(path.join(root, name)), name + " export missing");
  }
  assert.ok(fs.existsSync(path.join(root, ".github/copilot-instructions.md")));
});

test("chat ingestion stores durable items in mock mode", (t) => {
  const root = temporaryProject(t);
  checkedCli(root, "init");
  fs.writeFileSync(path.join(root, "chat-notes.txt"),
    "We decided to keep authentication local for privacy reasons while preparing the project.\n\n" +
    "The next task is to document error handling and support all users.");
  const output = checkedCli(root, "ingest-chat", "chat-notes.txt");
  assert.match(output, /Ingested [1-9]\d* durable memory items/);
  assert.match(fs.readFileSync(path.join(root, ".contextforge/DECISIONS.md"), "utf8"), /authentication local/);
});

test("invalid CLI commands return a nonzero exit status", (t) => {
  const root = temporaryProject(t);
  const result = runCli(root, "not-a-command");
  assert.notEqual(result.status, 0);
});

test("agent exports refuse to overwrite a pre-existing file without --force", (t) => {
  const root = temporaryProject(t);
  checkedCli(root, "init");
  const target = path.join(root, "AGENTS.md");
  fs.writeFileSync(target, "# Existing human instructions\n");
  const attempt = runCli(root, "export", "--all");
  assert.notEqual(attempt.status, 0);
  assert.match(attempt.stderr, /Export refused to overwrite/);
  assert.equal(fs.readFileSync(target, "utf8"), "# Existing human instructions\n");
  assert.equal(fs.existsSync(path.join(root, "CLAUDE.md")), false,
    "collision should prevent partial export");
  checkedCli(root, "export", "--all", "--force");
  assert.notEqual(fs.readFileSync(target, "utf8"), "# Existing human instructions\n");
});

test("unified checkpoint, tiered recall, audit, repair, and sync commands work cleanly", (t) => {
  const root = temporaryProject(t);
  checkedCli(root, "init");

  // Checkpoint typed memories
  const out1 = checkedCli(root, "checkpoint", "Use SQLite for local storage",
    "--kind", "decision", "--source", "README.md", "--tags", "sqlite,storage");
  assert.match(out1, /Saved: \[decision\] [a-f0-9]{12}/);
  assert.match(out1, /Synced to Markdown: DECISIONS/);

  checkedCli(root, "checkpoint", "Review Windows CI failure", "--kind", "blocker");
  checkedCli(root, "checkpoint", "Add integration tests for tiered recall", "--kind", "next");

  // Audit
  const auditOut = checkedCli(root, "audit", "--verbose");
  assert.match(auditOut, /OK: 3 records; 3 active; integrity chain valid/);
  assert.match(auditOut, /blocker: 1/);
  assert.match(auditOut, /decision: 1/);
  assert.match(auditOut, /next: 1/);

  // Tiered recall: handoff
  const handoff = checkedCli(root, "recall", "--level", "handoff", "--budget-chars", "1500");
  assert.match(handoff, /# ContextForge session handoff/);
  assert.match(handoff, /Review Windows CI failure/);
  assert.match(handoff, /Add integration tests for tiered recall/);

  // Tiered recall: capsule
  const capsule = checkedCli(root, "recall", "SQLite storage", "--level", "capsule", "--budget-chars", "3000");
  assert.match(capsule, /# ContextForge context capsule/);
  assert.match(capsule, /Use SQLite for local storage/);

  // Tiered recall: evidence JSON
  const evidenceJson = checkedCli(root, "recall", "--level", "evidence", "--format", "json", "--budget-chars", "5000");
  const parsedRecords = JSON.parse(evidenceJson);
  assert.ok(Array.isArray(parsedRecords));
  assert.ok(parsedRecords.length >= 2);
  assert.ok(parsedRecords[0].event.digest);

  // Repair on clean log reports clean
  const repairClean = checkedCli(root, "repair");
  assert.match(repairClean, /OK: storage clean/);

  // Sync preserves items
  const syncOut = checkedCli(root, "sync");
  assert.match(syncOut, /Synced memory: imported/);
});

test("Node CLI and Python skill script are 100% hash-chain interoperable", (t) => {
  const root = temporaryProject(t);
  checkedCli(root, "init");

  // Step 1: Save using Node CLI
  checkedCli(root, "checkpoint", "Written by Node CLI", "--kind", "decision", "--source", "README.md");

  // Step 2: Audit using Python skill script
  const pyAudit1 = runPython(root, "audit");
  assert.equal(pyAudit1.status, 0, "Python audit failed: " + pyAudit1.stderr);
  assert.match(pyAudit1.stdout, /OK: 1 records; 1 active; integrity chain valid/);

  // Step 3: Save using Python skill script
  const pySave = runPython(root, "save", "--kind", "next", "--text", "Written by Python script");
  assert.equal(pySave.status, 0, "Python save failed: " + pySave.stderr);

  // Step 4: Audit using Node CLI
  const nodeAudit = checkedCli(root, "audit", "--verbose");
  assert.match(nodeAudit, /OK: 2 records; 2 active; integrity chain valid/);

  // Step 5: Recall using Node CLI includes Python-authored note
  const nodeRecall = checkedCli(root, "recall", "--level", "handoff");
  assert.match(nodeRecall, /Written by Python script/);
  assert.match(nodeRecall, /Written by Node CLI/);

  // Step 6: Recall using Python includes Node-authored note
  const pyRecall = runPython(root, "recall", "--task", "Node CLI");
  assert.equal(pyRecall.status, 0);
  assert.match(pyRecall.stdout, /Written by Node CLI/);
});
