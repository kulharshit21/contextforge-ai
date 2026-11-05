"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const CLI = path.resolve(__dirname, "..", "bin", "contextforge.js");

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
