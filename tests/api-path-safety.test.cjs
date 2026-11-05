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

function runTsxScript(t, scriptName, scriptBody, extraEnv = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-api-safety-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scriptPath = path.join(root, scriptName);
  fs.writeFileSync(scriptPath, scriptBody);
  const result = spawnSync(process.execPath, ["--import", tsxImportURL, scriptPath], {
    cwd: root,
    encoding: "utf8",
    timeout: 180000,
    env: {
      ...process.env,
      CONTEXTFORGE_REPO_ROOT: repoRoot,
      CONTEXTFORGE_AI_PROVIDER: "mock",
      CONTEXTFORGE_PRIVACY_MODE: "local",
      TSX_TSCONFIG_PATH: path.join(repoRoot, "tsconfig.json"),
      ...extraEnv,
    },
  });
  return { root, result };
}

// Verifies that memory file writes reject traversal file keys before any path
// is derived, both at the lib layer and through the PUT /api/memory handler.
const MEMORY_WRITE_SCRIPT = [
  'import assert from "node:assert/strict";',
  'import fs from "node:fs";',
  'import path from "node:path";',
  'import { pathToFileURL } from "node:url";',
  '',
  'const repoRoot = process.env.CONTEXTFORGE_REPO_ROOT;',
  'const engineUrl = pathToFileURL(path.join(repoRoot, "lib", "memory", "engine.ts")).href;',
  'const routeUrl = pathToFileURL(path.join(repoRoot, "app", "api", "memory", "route.ts")).href;',
  '',
  'const { initWorkspace, saveMemoryFileRaw } = await import(engineUrl);',
  'const { PUT } = await import(routeUrl);',
  '',
  'const workspaceRoot = path.join(process.cwd(), "ws");',
  'await initWorkspace(workspaceRoot);',
  '',
  '// 1. Lib-level traversal file key is rejected before any file is written.',
  'const escapeFile = path.resolve(workspaceRoot, "..", "lib-escape.md");',
  'await assert.rejects(',
  '  () => saveMemoryFileRaw(workspaceRoot, "../../lib-escape",',
  '    "---\\nfile_key: PROJECT_STATE\\ntitle: t\\npurpose: p\\nsummary: s\\nversion: 1\\nitems: []\\n---\\nbody\\n"),',
  '  /Invalid memory file key/,',
  ');',
  'assert.equal(fs.existsSync(escapeFile), false, "traversal fileKey must not write outside the workspace");',
  'assert.equal(fs.existsSync(path.join(workspaceRoot, "lib-escape.md")), false);',
  '',
  '// 2. Lib-level valid key still writes the expected markdown file.',
  'const saved = await saveMemoryFileRaw(workspaceRoot, "DECISIONS",',
  '  "---\\nfile_key: DECISIONS\\ntitle: Decisions\\npurpose: p\\nsummary: ok\\nversion: 1\\nitems: []\\n---\\n\\nbody\\n");',
  'assert.equal(saved.file_key, "DECISIONS");',
  'assert.ok(fs.existsSync(path.join(workspaceRoot, ".contextforge", "DECISIONS.md")));',
  '',
  '// 3. PUT /api/memory rejects a traversal file key with a 400 response.',
  'const evilRequest = new Request("http://127.0.0.1:3000/api/memory", {',
  '  method: "PUT",',
  '  headers: { "content-type": "application/json" },',
  '  body: JSON.stringify({',
  '    projectId: "starter-local",',
  '    fileKey: "../../../../route-escape",',
  '    content: "---\\nfile_key: PROJECT_STATE\\ntitle: t\\npurpose: p\\nsummary: s\\nversion: 1\\nitems: []\\n---\\nbody",',
  '  }),',
  '});',
  'const evilResponse = await PUT(evilRequest);',
  'assert.equal(evilResponse.status, 400);',
  'const evilBody = await evilResponse.json();',
  'assert.match(evilBody.error, /Invalid request/);',
  'assert.equal(fs.existsSync(path.resolve(process.cwd(), "..", "route-escape.md")), false,',
  '  "route traversal must not write outside the dashboard root");',
  '',
  '// 4. PUT /api/memory still writes valid keys (dashboard editing keeps working).',
  'const goodRequest = new Request("http://127.0.0.1:3000/api/memory", {',
  '  method: "PUT",',
  '  headers: { "content-type": "application/json" },',
  '  body: JSON.stringify({',
  '    projectId: "starter-local",',
  '    fileKey: "FEATURES",',
  '    content: "---\\nfile_key: FEATURES\\ntitle: Features\\npurpose: p\\nsummary: s\\nversion: 1\\nitems: []\\n---\\n\\n# Features\\n",',
  '  }),',
  '});',
  'const goodResponse = await PUT(goodRequest);',
  'assert.equal(goodResponse.status, 200);',
  'const starterRoot = path.join(process.cwd(), "workspaces", "contextforge-starter");',
  'assert.ok(fs.existsSync(path.join(starterRoot, ".contextforge", "FEATURES.md")));',
  '',
  'console.log("memory write safety checks passed");',
].join("\n");

// Verifies that runProjectScan refuses missing, symlinked, and out-of-root
// scan targets by default, while inside-root targets keep working.
const SCAN_BOUNDARY_SCRIPT = [
  'import assert from "node:assert/strict";',
  'import fs from "node:fs";',
  'import path from "node:path";',
  'import { pathToFileURL } from "node:url";',
  '',
  'const repoRoot = process.env.CONTEXTFORGE_REPO_ROOT;',
  'const projectsUrl = pathToFileURL(path.join(repoRoot, "lib", "server", "projects.ts")).href;',
  'const { createProject, runProjectScan } = await import(projectsUrl);',
  '',
  '// 1. The starter project (hint = dashboard root itself) still scans fine.',
  'const starterScan = await runProjectScan("starter-local");',
  'assert.equal(starterScan.workspace_root.toLowerCase(), fs.realpathSync(process.cwd()).toLowerCase());',
  '',
  '// 2. A directory inside the dashboard root scans fine.',
  'const sampleDir = path.join(process.cwd(), "sample-repo");',
  'fs.mkdirSync(sampleDir, { recursive: true });',
  'fs.writeFileSync(path.join(sampleDir, "package.json"), JSON.stringify({ name: "sample-repo" }));',
  'fs.writeFileSync(path.join(sampleDir, "README.md"), "# Sample repo\\n");',
  'const inside = await createProject({ name: "inside-scan", description: "", localPathHint: sampleDir });',
  'const insideScan = await runProjectScan(inside.id);',
  'assert.equal(insideScan.workspace_root.toLowerCase(), fs.realpathSync(sampleDir).toLowerCase());',
  'assert.ok(Array.isArray(insideScan.app_routes));',
  '',
  '// 3. A missing directory fails with a clear error instead of raw scandir noise.',
  'const missing = await createProject({ name: "missing-scan", description: "",',
  '  localPathHint: path.join(process.cwd(), "does-not-exist") });',
  'await assert.rejects(() => runProjectScan(missing.id), /does not exist or is not accessible/);',
  '',
  '// 4. A directory outside the dashboard root is refused by default.',
  'const outside = await createProject({ name: "outside-scan", description: "",',
  '  localPathHint: repoRoot });',
  'await assert.rejects(() => runProjectScan(outside.id), /Refusing to scan directories outside/);',
  '',
  'console.log("scan boundary checks passed");',
].join("\n");

// Verifies the explicit opt-in for scanning paths outside the dashboard root.
const SCAN_OPT_IN_SCRIPT = [
  'import assert from "node:assert/strict";',
  'import fs from "node:fs";',
  'import path from "node:path";',
  'import { pathToFileURL } from "node:url";',
  '',
  'const repoRoot = process.env.CONTEXTFORGE_REPO_ROOT;',
  'const outsideFixture = process.env.CONTEXTFORGE_OUTSIDE_FIXTURE;',
  'const projectsUrl = pathToFileURL(path.join(repoRoot, "lib", "server", "projects.ts")).href;',
  'const { createProject, runProjectScan } = await import(projectsUrl);',
  '',
  'const outside = await createProject({ name: "opt-in-scan", description: "",',
  '  localPathHint: outsideFixture });',
  'const scan = await runProjectScan(outside.id);',
  'assert.equal(scan.workspace_root.toLowerCase(), fs.realpathSync(outsideFixture).toLowerCase());',
  '',
  'console.log("scan opt-in check passed");',
].join("\n");

test("dashboard memory writes reject traversal file keys and accept valid keys", (t) => {
  const { result } = runTsxScript(t, "memory-write-safety.mts", MEMORY_WRITE_SCRIPT);
  assert.equal(result.status, 0,
    "memory write safety script failed:\n" + result.stdout + "\n" + result.stderr);
  assert.match(result.stdout, /memory write safety checks passed/);
});

test("project scan refuses missing and out-of-root targets but scans inside the dashboard root", (t) => {
  const { result } = runTsxScript(t, "scan-boundary.mts", SCAN_BOUNDARY_SCRIPT);
  assert.equal(result.status, 0,
    "scan boundary script failed:\n" + result.stdout + "\n" + result.stderr);
  assert.match(result.stdout, /scan boundary checks passed/);
});

test("project scan allows external paths only with CONTEXTFORGE_ALLOW_EXTERNAL_SCAN=1", (t) => {
  const outsideFixture = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-outside-"));
  t.after(() => fs.rmSync(outsideFixture, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outsideFixture, "package.json"), JSON.stringify({ name: "outside-fixture" }));
  fs.writeFileSync(path.join(outsideFixture, "README.md"), "# Outside fixture\n");

  const { result } = runTsxScript(t, "scan-opt-in.mts", SCAN_OPT_IN_SCRIPT, {
    CONTEXTFORGE_ALLOW_EXTERNAL_SCAN: "1",
    CONTEXTFORGE_OUTSIDE_FIXTURE: outsideFixture,
  });
  assert.equal(result.status, 0,
    "scan opt-in script failed:\n" + result.stdout + "\n" + result.stderr);
  assert.match(result.stdout, /scan opt-in check passed/);
});

test("project scan refuses external paths even when the opt-in env var is disabled", (t) => {
  const outsideFixture = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-outside-"));
  t.after(() => fs.rmSync(outsideFixture, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outsideFixture, "package.json"), JSON.stringify({ name: "outside-fixture" }));

  const { result } = runTsxScript(t, "scan-opt-in-off.mts", [
    'import assert from "node:assert/strict";',
    'import path from "node:path";',
    'import { pathToFileURL } from "node:url";',
    '',
    'const repoRoot = process.env.CONTEXTFORGE_REPO_ROOT;',
    'const outsideFixture = process.env.CONTEXTFORGE_OUTSIDE_FIXTURE;',
    'const projectsUrl = pathToFileURL(path.join(repoRoot, "lib", "server", "projects.ts")).href;',
    'const { createProject, runProjectScan } = await import(projectsUrl);',
    '',
    'const outside = await createProject({ name: "opt-off-scan", description: "",',
    '  localPathHint: outsideFixture });',
    'await assert.rejects(() => runProjectScan(outside.id), /Refusing to scan directories outside/);',
    '',
    'console.log("scan opt-off check passed");',
  ].join("\n"), {
    CONTEXTFORGE_ALLOW_EXTERNAL_SCAN: "0",
    CONTEXTFORGE_OUTSIDE_FIXTURE: outsideFixture,
  });
  assert.equal(result.status, 0,
    "scan opt-off script failed:\n" + result.stdout + "\n" + result.stderr);
  assert.match(result.stdout, /scan opt-off check passed/);
});

// Verifies canonical (realpath) boundary checks: a symlinked parent inside the
// dashboard root must not smuggle a canonically-outside target past the
// lexical check, direct symlink targets stay refused, and the scanner itself
// must not traverse internal symlinks out of the validated root.
const SCAN_SYMLINK_SCRIPT = [
  'import assert from "node:assert/strict";',
  'import fs from "node:fs";',
  'import path from "node:path";',
  'import { pathToFileURL } from "node:url";',
  '',
  'const repoRoot = process.env.CONTEXTFORGE_REPO_ROOT;',
  'const outsideDir = process.env.CONTEXTFORGE_OUTSIDE_DIR;',
  'const outsideApp = process.env.CONTEXTFORGE_OUTSIDE_APP;',
  'const projectsUrl = pathToFileURL(path.join(repoRoot, "lib", "server", "projects.ts")).href;',
  'const { createProject, runProjectScan } = await import(projectsUrl);',
  '',
  'function trySymlink(target, linkPath) {',
  '  try {',
  '    fs.symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");',
  '    return true;',
  '  } catch (error) {',
  '    if (error && ["EPERM", "EACCES", "ENOSYS"].includes(error.code)) return false;',
  '    throw error;',
  '  }',
  '}',
  '',
  '// 1. Symlinked parent inside the root with a real leaf subdir outside it.',
  'const parentLink = path.join(process.cwd(), "link-parent");',
  'if (trySymlink(outsideDir, parentLink)) {',
  '  const bypassTarget = path.join(parentLink, "inner");',
  '  const bypass = await createProject({ name: "symlink-bypass", description: "",',
  '    localPathHint: bypassTarget });',
  '  await assert.rejects(() => runProjectScan(bypass.id), /Refusing to scan directories outside/);',
  '',
  '  // 2. A direct symlink target stays refused with the symlink-specific error.',
  '  const leafLink = path.join(process.cwd(), "link-leaf");',
  '  fs.symlinkSync(path.join(outsideDir, "inner"), leafLink,',
  '    process.platform === "win32" ? "junction" : "dir");',
  '  const direct = await createProject({ name: "symlink-direct", description: "",',
  '    localPathHint: leafLink });',
  '  await assert.rejects(() => runProjectScan(direct.id), /cannot be a symbolic link/);',
  '',
  '  // 3. An internal symlink inside an approved root is not traversed by the scanner.',
  '  const insideRoot = path.join(process.cwd(), "sample-internal");',
  '  fs.mkdirSync(insideRoot, { recursive: true });',
  '  fs.writeFileSync(path.join(insideRoot, "package.json"), JSON.stringify({ name: "sample-internal" }));',
  '  fs.writeFileSync(path.join(insideRoot, "README.md"), "# Internal sample\\n");',
  '  fs.symlinkSync(path.join(outsideApp, "app"), path.join(insideRoot, "app"),',
  '    process.platform === "win32" ? "junction" : "dir");',
  '  const internal = await createProject({ name: "internal-scan", description: "",',
  '    localPathHint: insideRoot });',
  '  const internalScan = await runProjectScan(internal.id);',
  '  assert.equal(internalScan.workspace_root.toLowerCase(), fs.realpathSync(insideRoot).toLowerCase());',
  '  assert.deepEqual(internalScan.app_routes, [], "scanner must not traverse internal symlinks");',
  '  assert.ok(!JSON.stringify(internalScan).includes("OUTSIDE-MARKER"),',
  '    "outside content must not leak into the scan result");',
  '',
  '  console.log("scan symlink checks passed");',
  '} else {',
  '  console.log("scan symlink checks skipped (symlink creation not permitted)");',
  '}',
].join("\n");

test("scan boundary blocks symlinked parents, direct symlinks, and internal symlink traversal", (t) => {
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-symlink-out-"));
  t.after(() => fs.rmSync(outsideDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(outsideDir, "inner", "app"), { recursive: true });
  fs.writeFileSync(path.join(outsideDir, "inner", "package.json"), JSON.stringify({ name: "outside-target" }));
  fs.writeFileSync(path.join(outsideDir, "inner", "README.md"), "# OUTSIDE-MARKER secret content beyond the boundary\n");
  fs.writeFileSync(path.join(outsideDir, "inner", "app", "page.tsx"), "export default () => null;\n");

  const outsideApp = fs.mkdtempSync(path.join(os.tmpdir(), "contextforge-symlink-app-"));
  t.after(() => fs.rmSync(outsideApp, { recursive: true, force: true }));
  fs.mkdirSync(path.join(outsideApp, "app"), { recursive: true });
  fs.writeFileSync(path.join(outsideApp, "app", "page.tsx"), "export default () => null;\n");

  const { result } = runTsxScript(t, "scan-symlink.mts", SCAN_SYMLINK_SCRIPT, {
    CONTEXTFORGE_OUTSIDE_DIR: outsideDir,
    CONTEXTFORGE_OUTSIDE_APP: outsideApp,
  });
  assert.equal(result.status, 0,
    "scan symlink script failed:\n" + result.stdout + "\n" + result.stderr);
  assert.match(result.stdout, /scan symlink (checks passed|checks skipped)/);
});
