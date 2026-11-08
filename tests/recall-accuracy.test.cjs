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
const PYTHON = path.join(
  repoRoot,
  ".agents",
  "skills",
  "contextforge-memory",
  "scripts",
  "contextforge_memory.py",
);

// Recall-accuracy ranking v2: length-normalized BM25 + calendar recency +
// abstention. The same algorithm is implemented in the Python skill; a
// cross-implementation parity check at the end compares retrieved order.
const ACCURACY_SCRIPT = [
  'import assert from "node:assert/strict";',
  'import fs from "node:fs";',
  'import path from "node:path";',
  'import { pathToFileURL } from "node:url";',
  '',
  'const repoRoot = process.env.CONTEXTFORGE_REPO_ROOT;',
  'const tieredUrl = pathToFileURL(path.join(repoRoot, "lib", "memory", "tiered-context.ts")).href;',
  'const { scoreAndRankEvents, buildTieredContext } = await import(tieredUrl);',
  '',
  'const now = Date.now();',
  'const daysAgo = (days) => new Date(now - days * 86_400_000).toISOString();',
  'const event = (id, kind, text, createdAt, tags = []) => ({',
  '  v: 1, id, created_at: createdAt, kind, text, source: "", tags,',
  '  supersedes: "", previous: "0".repeat(64), digest: "0".repeat(64),',
  '});',
  '',
  '// 1. A short, on-topic record outranks a long record that merely mentions',
  '//    the query term once (length normalization + tf saturation).',
  'const events = [',
  '  event("aaaaaaaaaaaa", "fact", "auth " + "filler ".repeat(400), daysAgo(0)),',
  '  event("bbbbbbbbbbbb", "decision", "auth middleware uses rotating refresh tokens", daysAgo(0)),',
  '];',
  'const ranked = await scoreAndRankEvents(events, "auth middleware tokens");',
  'assert.equal(ranked[0].event.id, "bbbbbbbbbbbb",',
  '  "the on-topic record must outrank the long noisy one");',
  '',
  '// 2. Calendar recency: an identical old record ranks below a fresh one.',
  'const recencyEvents = [',
  '  event("cccccccccccc", "fact", "identical relevant content", daysAgo(60)),',
  '  event("dddddddddddd", "fact", "identical relevant content", daysAgo(1)),',
  '];',
  'const recencyRanked = await scoreAndRankEvents(recencyEvents, "relevant content");',
  'assert.equal(recencyRanked[0].event.id, "dddddddddddd", "fresher record wins");',
  '',
  '// 3. Abstention: when nothing matches, the output says so.',
  'const abstainEvents = [',
  '  event("eeeeeeeeeeee", "blocker", "Deploy blocked on credentials", daysAgo(0)),',
  '];',
  'const abstain = await buildTieredContext(abstainEvents, { task: "kubernetes ingress", level: "handoff" });',
  'assert.match(abstain.output, /No memory records matched the task keywords/);',
  'assert.match(abstain.output, /Deploy blocked on credentials/, "priority records still listed");',
  '',
  '// 4. Strong relevance outranks a fresh priority record once the corpus',
  '//    gives query terms real IDF weight (realistic-corpus shape).',
  'const mixed = [',
  '  event("ffffffffffff", "blocker", "Unrelated blocker text", daysAgo(0)),',
  '  event("111111111111", "decision", "auth tokens rotate every session", daysAgo(30)),',
  '];',
  'for (let i = 0; i < 8; i++) {',
  '  mixed.push(event(("22222222" + String(i).padStart(4, "0")), "fact",',
  '    "unrelated filler record number " + i + " about deploy scripts", daysAgo(3)));',
  '}',
  'const mixedRanked = await scoreAndRankEvents(mixed, "auth tokens rotate");',
  'assert.equal(mixedRanked[0].event.id, "111111111111",',
  '  "strongly relevant records outrank priority records in a realistic corpus");',
  'assert.equal(mixedRanked[mixedRanked.length - 1].event.id, "ffffffffffff",',
  '  "the zero-overlap blocker ranks last among kept records");',
  '',
  'console.log("recall accuracy checks passed");',
].join("\n");

test("recall accuracy: length normalization, calendar recency, abstention", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-accuracy-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scriptPath = path.join(root, "accuracy.mts");
  fs.writeFileSync(scriptPath, ACCURACY_SCRIPT);
  const result = spawnSync(process.execPath, ["--import", tsxImportURL, scriptPath], {
    cwd: root,
    encoding: "utf8",
    timeout: 240000,
    env: {
      ...process.env,
      CONTEXTFORGE_REPO_ROOT: repoRoot,
      CONTEXTFORGE_AI_PROVIDER: "mock",
      TSX_TSCONFIG_PATH: path.join(repoRoot, "tsconfig.json"),
    },
  });
  assert.equal(result.status, 0,
    "accuracy script failed:\n" + result.stdout + "\n" + result.stderr);
  assert.match(result.stdout, /recall accuracy checks passed/);
});

// Cross-implementation parity: Node and the Python skill must return the same
// record order for the same journal and task.
function idOrder(text) {
  return [...text.matchAll(/\(id: ([0-9a-f]{12})/g)].map((match) => match[1]);
}

test("node and python recall produce the same record order for the same journal", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-parity-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = (...args) =>
    spawnSync(process.execPath, [path.join(repoRoot, "bin", "contextforge.js"), ...args], {
      cwd: root, encoding: "utf8", timeout: 180000,
      env: { ...process.env, CONTEXTFORGE_AI_PROVIDER: "mock" },
    });
  const runPython = (...args) =>
    spawnSync("python", [PYTHON, "--root", root, ...args], { cwd: root, encoding: "utf8", timeout: 120000 });

  assert.equal(run("init").status, 0);
  // Timestamps: one fresh note, one old (backdated via the Python skill's
  // journal directly is overkill — create in order and rely on created_at).
  assert.equal(run("checkpoint", "auth tokens rotate every session", "--kind", "decision").status, 0);
  assert.equal(run("checkpoint", "Deploy blocked on credentials", "--kind", "blocker").status, 0);
  assert.equal(run("checkpoint", "The logo is an orange rocket", "--kind", "fact").status, 0);

  const task = "auth tokens rotate";
  const nodeOut = run("recall", task, "--level", "handoff", "--budget-chars", "4000");
  assert.equal(nodeOut.status, 0, nodeOut.stderr);
  const pyOut = runPython("recall", "--task", task, "--budget-chars", "4000");
  assert.equal(pyOut.status, 0, pyOut.stderr);

  const nodeOrder = idOrder(nodeOut.stdout);
  const pyOrder = idOrder(pyOut.stdout);
  assert.ok(nodeOrder.length >= 2, "fixture must retrieve several records");
  assert.deepEqual(pyOrder, nodeOrder,
    `Python order [${pyOrder}] must equal Node order [${nodeOrder}]`);
});
