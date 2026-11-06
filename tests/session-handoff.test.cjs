/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const CLI = path.resolve(__dirname, "..", "bin", "contextforge.js");

function tempProject(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-handoff-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "README.md"), "# Handoff fixture\n");
  return dir;
}

function run(root, ...args) {
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

function ok(root, ...args) {
  const result = run(root, ...args);
  assert.equal(result.status, 0,
    "contextforge " + args.join(" ") + " failed:\n" + result.stdout + result.stderr);
  return result.stdout;
}

function events(root) {
  const journalPath = path.join(root, ".contextforge", "agent-memory", "events.jsonl");
  if (!fs.existsSync(journalPath)) return [];
  return fs.readFileSync(journalPath, "utf8").trim().split("\n")
    .filter(Boolean).map((line) => JSON.parse(line));
}

test("handoff checkpoints verified outcomes and resume restores them without adding records", (t) => {
  const root = tempProject(t);
  const handoff = ok(root, "handoff", "Finish authentication middleware",
    "--done", "Login route and middleware are implemented",
    "--failed", "Session cache in memory failed because tests reset state",
    "--test", "npm test passed on this fixture",
    "--blocker", "Need production cookie settings review",
    "--next", "Add regression test for cookie expiry",
    "--source", "README.md",
    "--budget-chars", "1800");
  assert.match(handoff, /# ContextForge session handoff/);
  assert.ok(handoff.length <= 1800, "handoff exceeds bounded context");
  assert.match(handoff, /Session cache in memory failed/);
  assert.match(handoff, /Add regression test for cookie expiry/);

  const recorded = events(root);
  assert.equal(recorded.length, 5);
  assert.deepEqual(recorded.map((entry) => entry.kind),
    ["handoff", "bug", "test", "blocker", "next"]);
  assert.ok(recorded.every((entry) => entry.source === "README.md"));
  const restored = ok(root, "resume", "Finish authentication middleware", "--budget-chars", "1800");
  assert.match(restored, /Login route and middleware are implemented/);
  assert.match(restored, /Need production cookie settings review/);
  assert.match(restored, /Add regression test for cookie expiry/);
  assert.ok(restored.length <= 1800);
  assert.equal(events(root).length, recorded.length, "resume must not save extra records");
  assert.match(ok(root, "audit"), /integrity chain valid/);
});

test("handoff refuses occupied output files before checkpointing, and creates only new files", (t) => {
  const root = tempProject(t);
  const protectedPath = path.join(root, "AGENTS.md");
  fs.writeFileSync(protectedPath, "# Developer-owned instructions\n");
  const rejected = run(root, "handoff", "Add tests", "--next", "Write integration test",
    "--out", protectedPath);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /Refusing to overwrite existing output file/);
  assert.equal(fs.readFileSync(protectedPath, "utf8"), "# Developer-owned instructions\n");
  assert.equal(events(root).length, 0, "no partial checkpoint on output collision");

  const fresh = path.join(root, "new-handoff.md");
  const saved = ok(root, "handoff", "Add tests", "--next", "Write integration test",
    "--out", fresh, "--budget-chars", "700");
  assert.match(saved, /Handoff saved/);
  assert.match(fs.readFileSync(fresh, "utf8"), /Write integration test/);
  assert.ok(fs.readFileSync(fresh, "utf8").length <= 700);
  const doubleSave = run(root, "resume", "Add tests", "--out", fresh);
  assert.notEqual(doubleSave.status, 0, "resume must refuse overwriting existing file");
});

test("handoff fails before writing on invalid, sensitive or missing inputs", (t) => {
  const root = tempProject(t);
  assert.notEqual(run(root, "handoff", "Unfinished task").status, 0);
  assert.equal(events(root).length, 0);

  const invalid = run(root, "handoff", "Fix CI",
    "--done", "Completed verification",
    "--next", "password=supersecretvalue");
  assert.notEqual(invalid.status, 0);
  assert.equal(events(root).length, 0, "all notes must be screened before any are saved");

  const budget = run(root, "handoff", "Fix CI", "--next", "Run test", "--budget-chars", "abc");
  assert.notEqual(budget.status, 0);
  assert.equal(events(root).length, 0);

  const longTask = run(root, "handoff", "x".repeat(201), "--next", "Run test");
  assert.notEqual(longTask.status, 0);
  assert.equal(events(root).length, 0);
});
