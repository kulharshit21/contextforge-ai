/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const CLI = path.join(repoRoot, "bin", "contextforge.js");

function temporaryProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-tasks-"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "tasks-fixture", scripts: { test: "node --test" } }),
  );
  return root;
}

test("tasks command lists, marks done, and keeps history", (t) => {
  const root = temporaryProject();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8", timeout: 180000 });

  assert.equal(run("init").status, 0);

  // Empty state
  const empty = run("tasks");
  assert.equal(empty.status, 0);
  assert.match(empty.stdout, /No open tasks/);

  // Save three next-records plus unrelated notes
  assert.equal(run("handoff", "Login feature", "--next", "TASK-write login tests").status, 0);
  assert.equal(run("handoff", "Login feature", "--next", "TASK-add cookie expiry").status, 0);
  assert.equal(run("checkpoint", "Unrelated fact about the logo", "--kind", "fact").status, 0);

  // Listing shows only next-records
  const listed = run("tasks");
  assert.equal(listed.status, 0);
  assert.match(listed.stdout, /Open tasks \(2\)/);
  assert.match(listed.stdout, /TASK-write login tests/);
  assert.match(listed.stdout, /TASK-add cookie expiry/);
  assert.doesNotMatch(listed.stdout, /Unrelated fact/);

  // Extract an id and mark it done
  const idMatch = listed.stdout.match(/- ([0-9a-f]{12})\s+\([^\)]*\)\s+.*TASK-write login tests/);
  assert.ok(idMatch, "listing must include record ids");
  const doneId = idMatch[1];

  const done = run("tasks", "--done", doneId);
  assert.equal(done.status, 0, done.stderr);
  assert.match(done.stdout, /Marked done/);
  assert.match(done.stdout, /Open tasks remaining: 1/);

  // The done task leaves the list
  const relisted = run("tasks");
  assert.doesNotMatch(relisted.stdout, /TASK-write login tests/);
  assert.match(relisted.stdout, /TASK-add cookie expiry/);

  // The journal keeps the completion history (supersede record)
  const audit = run("audit");
  assert.match(audit.stdout, /OK: 4 records; 3 active/);

  // Invalid id is rejected cleanly
  const bad = run("tasks", "--done", "notanid");
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /12-character record id/);
});
