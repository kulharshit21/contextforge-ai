/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const tsxImportURL = pathToFileURL(require.resolve("tsx", { paths: [repoRoot] })).href;

test("dashboard per-project local privacy blocks Gemini and validates extraction requests", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-privacy-regression-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "privacy.mts");
  fs.writeFileSync(file, [
    'import assert from "node:assert/strict";',
    'import path from "node:path";',
    'import { pathToFileURL } from "node:url";',
    'const base = process.env.CONTEXTFORGE_REPO_ROOT;',
    'const ai = await import(pathToFileURL(path.join(base, "lib", "ai", "index.ts")).href);',
    'const schemas = await import(pathToFileURL(path.join(base, "lib", "memory", "schemas.ts")).href);',
    'const route = await import(pathToFileURL(path.join(base, "app", "api", "ai", "extract", "route.ts")).href);',
    'const local = ai.resolveProvider("gemini", "local");',
    'assert.equal(local.privacyMode, "local");',
    'assert.notEqual(local.effectiveProvider, "gemini", "project-local must not select cloud Gemini even with global cloud mode");',
    'const result = schemas.ProjectSettingsSchema.parse({ privacyMode: "local", aiProvider: "mock", geminiApiKey: "DEAD-SECRET-MARKER", ollamaUrl: "http://example.invalid" });',
    'assert.equal(Object.hasOwn(result, "geminiApiKey"), false, "obsolete API key must not be reflected in persisted settings");',
    'assert.equal(Object.hasOwn(result, "ollamaUrl"), false, "obsolete provider URL must not be reflected");',
    'const malformed = new Request("http://127.0.0.1:3000/api/ai/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: "starter-local", text: "hello", persist: "false" }) });',
    'const badResponse = await route.POST(malformed);',
    'assert.equal(badResponse.status, 400, "string persist must not be treated as true");',
    'const huge = new Request("http://127.0.0.1:3000/api/ai/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: "starter-local", text: "x".repeat(200001) }) });',
    'const hugeResponse = await route.POST(huge);',
    'assert.equal(hugeResponse.status, 400, "oversized input must fail before provider calls");',
    'console.log("privacy regression assertions passed");'
  ].join("\n"));
  const result = spawnSync(process.execPath, ["--import", tsxImportURL, file], {
    cwd: root, encoding: "utf8", timeout: 120000,
    env: {
      ...process.env,
      CONTEXTFORGE_REPO_ROOT: repoRoot,
      CONTEXTFORGE_PRIVACY_MODE: "cloud",
      CONTEXTFORGE_AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "FAKE_TEST_KEY_DO_NOT_USE",
      TSX_TSCONFIG_PATH: path.join(repoRoot, "tsconfig.json"),
    },
  });
  assert.equal(result.status, 0, result.stdout + "\n" + result.stderr);
  assert.match(result.stdout, /privacy regression assertions passed/);
});
