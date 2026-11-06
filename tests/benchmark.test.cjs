/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("reproducible context-retention benchmark against equal-budget baselines", () => {
  const runnerPath = path.join(__dirname, "..", "benchmarks", "run_benchmark.py");
  const result = spawnSync("python", [runnerPath, "1200"], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf-8",
    timeout: 60000,
  });

  assert.equal(
    result.status,
    0,
    `Benchmark runner failed with status ${result.status}:\n${result.stderr}`
  );

  const resultsFile = path.join(__dirname, "..", "benchmarks", "results.json");
  assert.ok(fs.existsSync(resultsFile), "benchmarks/results.json should be written");

  const data = JSON.parse(fs.readFileSync(resultsFile, "utf-8"));
  assert.equal(data.config.num_scenarios, 30, "Benchmark must cover at least 30 scenarios");

  const cf = data.summary.contextforge_lexical;
  const rec = data.summary.recency_truncation;

  // 1. Critical Fact Recall
  assert.ok(
    cf.recall_mean >= 0.80,
    `ContextForge recall mean (${cf.recall_mean}) should be at least 80%`
  );
  assert.ok(
    cf.recall_mean > rec.recall_mean,
    `ContextForge recall (${cf.recall_mean}) must outperform naive recency (${rec.recall_mean}) under constrained budget`
  );

  // 2. Source-string presence (not human-verified citation fidelity)
  assert.ok(
    cf.citation_rate_mean >= 0.75,
    `ContextForge citation fidelity (${cf.citation_rate_mean}) should be at least 75%`
  );

  // 3. Exact suspicious-string inclusion (not downstream agent safety)
  assert.ok(
    cf.total_injections_leaked <= 5,
    `ContextForge should neutralize prompt injections (leaked: ${cf.total_injections_leaked} vs recency: ${rec.total_injections_leaked})`
  );

  // 3b. Stale-record leakage: superseded records must never surface in
  // retrieval, or recall numbers inflate while handing agents stale facts.
  assert.ok(
    cf.stale_leak_mean <= 0,
    `ContextForge must not leak superseded records (stale_leak_mean: ${cf.stale_leak_mean})`
  );

  // 4. Recovery Latency
  assert.ok(
    cf.latency_mean_ms < 250,
    `ContextForge retrieval latency (${cf.latency_mean_ms}ms) should be under 250ms`
  );

  // 5. Negative Cases Documented
  assert.ok(
    Array.isArray(data.negative_cases),
    "Negative cases must be tracked and documented"
  );
});
