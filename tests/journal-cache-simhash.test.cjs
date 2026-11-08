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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-journal-"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "journal-fixture", scripts: { test: "node --test" } }),
  );
  return root;
}

// Journal cache + simhash near-dup regression coverage.
const CACHE_SCRIPT = [
  'import assert from "node:assert/strict";',
  'import fs from "node:fs";',
  'import path from "node:path";',
  'import { pathToFileURL } from "node:url";',
  '',
  'const repoRoot = process.env.CONTEXTFORGE_REPO_ROOT;',
  'const journalUrl = pathToFileURL(path.join(repoRoot, "lib", "memory", "journal.ts")).href;',
  'const { appendJournalEvent, auditJournal, computeDigest, readJournalEvents } = await import(journalUrl);',
  '',
  'const root = path.join(process.cwd(), "journal-ws");',
  'const eventsPath = path.join(root, ".contextforge", "agent-memory", "events.jsonl");',
  'fs.mkdirSync(path.dirname(eventsPath), { recursive: true });',
  '',
  '// 1. Cached read, then an EXTERNAL append (simulating the Python skill or',
  '//    a second CLI) writing straight to the file: the next read must pick',
  '//    up the new record through tail verification.',
  'await appendJournalEvent(root, { kind: "fact", text: "CACHE-first record" });',
  'const firstRead = await readJournalEvents(root);',
  'assert.equal(firstRead.length, 1);',
  'const second = { v: 1, id: "bbbbbbbbbbbb", created_at: new Date().toISOString(), kind: "next", text: "CACHE-second record", source: "", tags: [], supersedes: "", previous: firstRead[firstRead.length - 1].digest };',
  'second.digest = computeDigest(second);',
  'fs.appendFileSync(eventsPath, JSON.stringify(second) + "\\n");',
  'const secondRead = await readJournalEvents(root);',
  'assert.equal(secondRead.length, 2, "external append must be picked up");',
  '',
  '// 2. A shrunk file (repair-style rewrite) must be fully re-read.',
  'const kept = secondRead[0];',
  'fs.writeFileSync(eventsPath, JSON.stringify(kept) + "\\n");',
  'const shrunkRead = await readJournalEvents(root);',
  'assert.equal(shrunkRead.length, 1);',
  '',
  '// 3. Audit still reports a valid chain after all of it (full verify).',
  'const audit = await auditJournal(root);',
  'assert.equal(audit.isValid, true);',
  '',
  'console.log("journal cache checks passed");',
].join("\n");

const SIMHASH_SCRIPT = [
  'import assert from "node:assert/strict";',
  'import { pathToFileURL } from "node:url";',
  'import path from "node:path";',
  '',
  'const repoRoot = process.env.CONTEXTFORGE_REPO_ROOT;',
  'const simhashUrl = pathToFileURL(path.join(repoRoot, "lib", "memory", "simhash.ts")).href;',
  'const { simhash64, hammingDistance } = await import(simhashUrl);',
  '',
  '// Determinism: identical tokens give identical fingerprints.',
  'const a = simhash64(["auth", "tokens", "rotate"]);',
  'const b = simhash64(["auth", "tokens", "rotate"]);',
  'assert.equal(a, b);',
  '// Unrelated token sets differ well beyond the threshold.',
  'const c = simhash64(["deploy", "credentials", "blocked"]);',
  'assert.ok(hammingDistance(a, c) > 10, "unrelated texts must differ widely");',
  '',
  'console.log("simhash checks passed");',
].join("\n");

test("journal cache: external appends picked up, shrinks re-read, audit chain valid", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-jc-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scriptPath = path.join(root, "cache.mts");
  fs.writeFileSync(scriptPath, CACHE_SCRIPT);
  const result = spawnSync(process.execPath, ["--import", tsxImportURL, scriptPath], {
    cwd: root,
    encoding: "utf8",
    timeout: 240000,
    env: { ...process.env, CONTEXTFORGE_REPO_ROOT: repoRoot, TSX_TSCONFIG_PATH: path.join(repoRoot, "tsconfig.json") },
  });
  assert.equal(result.status, 0, "cache script failed:\n" + result.stdout + "\n" + result.stderr);
  assert.match(result.stdout, /journal cache checks passed/);
});

test("simhash fingerprints are deterministic and discriminating", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-sh-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scriptPath = path.join(root, "simhash.mts");
  fs.writeFileSync(scriptPath, SIMHASH_SCRIPT);
  const result = spawnSync(process.execPath, ["--import", tsxImportURL, scriptPath], {
    cwd: root,
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, CONTEXTFORGE_REPO_ROOT: repoRoot, TSX_TSCONFIG_PATH: path.join(repoRoot, "tsconfig.json") },
  });
  assert.equal(result.status, 0, "simhash script failed:\n" + result.stdout + "\n" + result.stderr);
  assert.match(result.stdout, /simhash checks passed/);
});

test("near-duplicate saves warn and still store (CLI, Node + Python skill)", (t) => {
  const root = temporaryProject();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8", timeout: 180000 });

  assert.equal(run("init").status, 0);
  const first = run("checkpoint", "Chose SQLite for the local cache layer", "--kind", "decision");
  assert.equal(first.status, 0);
  assert.equal(first.stderr.includes("near-duplicate"), false, "first save must not warn");

  const reworded = run("checkpoint", "Chose SQLite for the local cache layer after review", "--kind", "decision");
  assert.equal(reworded.status, 0, "near-dup saves proceed (warn-not-block)");
  assert.match(reworded.stderr, /near-duplicate of record/, "re-worded near-duplicate must warn");

  const unrelated = run("checkpoint", "Switched the documentation site to Starlight", "--kind", "decision");
  assert.equal(unrelated.status, 0);
  assert.equal(unrelated.stderr.includes("near-duplicate"), false, "unrelated note must not warn");

  const audit = run("audit");
  assert.match(audit.stdout, /OK: 3 records/);
});
