/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const CLI = path.resolve(__dirname, "..", "bin", "contextforge.js");

function temporaryProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-drift-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "contextforge-drift-fixture",
      version: "1.0.0",
      scripts: {
        build: "next build",
        dev: "next dev",
        test: "node --test",
      },
    }, null, 2),
  );
  fs.writeFileSync(path.join(root, "README.md"), "# Drift Test Fixture\n");
  fs.writeFileSync(path.join(root, ".env.example"), "NEXT_PUBLIC_APP_URL=http://localhost:3000\n");
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
  assert.equal(
    result.status,
    0,
    "contextforge " + args.join(" ") + " failed:\n" + result.stdout + "\n" + result.stderr,
  );
  return result.stdout;
}

test("note classification handles mixed decision, bug, API, and rule wording with correct precedence", (t) => {
  const root = temporaryProject(t);
  checkedCli(root, "init");

  // 1. Mixed decision and API wording: must be DECISIONS, not API_CONTRACTS
  checkedCli(root, "remember", "We decided to deprecate the legacy /v1/auth REST endpoint in favor of session cookies.");
  const decisions = fs.readFileSync(path.join(root, ".contextforge", "DECISIONS.md"), "utf8");
  assert.match(decisions, /deprecate the legacy \/v1\/auth/);
  const apis = fs.readFileSync(path.join(root, ".contextforge", "API_CONTRACTS.md"), "utf8");
  assert.doesNotMatch(apis, /deprecate the legacy \/v1\/auth/);

  // 2. Pure API contract: must go to API_CONTRACTS
  checkedCli(root, "remember", "The POST /api/memory route accepts a JSON payload with workspaceRoot and fileKey.");
  const apisUpdated = fs.readFileSync(path.join(root, ".contextforge", "API_CONTRACTS.md"), "utf8");
  assert.match(apisUpdated, /POST \/api\/memory route accepts/);

  // 3. Mixed bug and feature wording: must go to BUGS_AND_FIXES, not FEATURES
  checkedCli(root, "remember", "Bug: invoice export feature crashes with redirect loop exception when token expires.");
  const bugs = fs.readFileSync(path.join(root, ".contextforge", "BUGS_AND_FIXES.md"), "utf8");
  assert.match(bugs, /invoice export feature crashes/);
  const features = fs.readFileSync(path.join(root, ".contextforge", "FEATURES.md"), "utf8");
  assert.doesNotMatch(features, /invoice export feature crashes/);

  // 4. Failed attempt: must go to FAILED_ATTEMPTS
  checkedCli(root, "remember", "Failed attempt: tried using WebSockets for live sync but it did not work behind proxies.");
  const failed = fs.readFileSync(path.join(root, ".contextforge", "FAILED_ATTEMPTS.md"), "utf8");
  assert.match(failed, /tried using WebSockets/);

  // 5. Coding and privacy rules: must go to CODING_RULES
  checkedCli(root, "remember", "Do not upload private customer data to Gemini or external LLMs without explicit user consent.");
  const rules = fs.readFileSync(path.join(root, ".contextforge", "CODING_RULES.md"), "utf8");
  assert.match(rules, /Do not upload private customer data/);

  // 6. Setup and environment: must go to ENV_AND_SETUP
  checkedCli(root, "remember", "Install dependencies with npm ci and set CONTEXTFORGE_PRIVACY_MODE=local in .env.");
  const env = fs.readFileSync(path.join(root, ".contextforge", "ENV_AND_SETUP.md"), "utf8");
  assert.match(env, /Install dependencies with npm ci/);

  // 7. Current tasks / next steps: must go to CURRENT_TASKS
  checkedCli(root, "remember", "Next step: add automated regression coverage for Windows CLI smoke test.");
  const tasks = fs.readFileSync(path.join(root, ".contextforge", "CURRENT_TASKS.md"), "utf8");
  assert.match(tasks, /add automated regression coverage/);

  // 8. Architecture data flow: must go to ARCHITECTURE
  checkedCli(root, "remember", "The system architecture uses an append-only journal with SHA-256 integrity hashing.");
  const arch = fs.readFileSync(path.join(root, ".contextforge", "ARCHITECTURE.md"), "utf8");
  assert.match(arch, /system architecture uses an append-only journal/);
});

test("drift detection flags missing scripts, missing file paths, framework mismatches, and undocumented env vars", (t) => {
  const root = temporaryProject(t);
  checkedCli(root, "init");
  checkedCli(root, "scan");

  // Initial doctor check should report healthy memory
  const initialDoctor = checkedCli(root, "doctor");
  assert.match(initialDoctor, /No drift issues found/);

  // 1. Introduce missing script drift: reference a command not in package.json
  checkedCli(root, "remember", "Run npm run migrate:test before deploying to staging.");
  const doctorWithScriptDrift = checkedCli(root, "doctor");
  assert.match(doctorWithScriptDrift, /Command referenced in memory is missing: npm run migrate:test/);
  assert.match(doctorWithScriptDrift, /medium/);

  // 2. Introduce framework mismatch drift: reference Express while repo scan is Next.js
  checkedCli(root, "remember", "The backend is built using Express framework for routing.");
  const doctorWithFrameworkDrift = checkedCli(root, "doctor");
  assert.match(doctorWithFrameworkDrift, /Memory mentions Express, repo scan says/);
  assert.match(doctorWithFrameworkDrift, /high/);

  // 3. Introduce undocumented environment variable drift
  checkedCli(root, "remember", "Configure CONTEXTFORGE_SECRET_TOKEN in local config.");
  const doctorWithEnvDrift = checkedCli(root, "doctor");
  assert.match(doctorWithEnvDrift, /Environment variable may be undocumented: CONTEXTFORGE_SECRET_TOKEN/);
  assert.match(doctorWithEnvDrift, /low/);

  // 4. Verify stats reflects drift warnings and reduced health score
  const stats = checkedCli(root, "stats");
  assert.match(stats, /Drift warnings: [1-9]\d*/);
});
