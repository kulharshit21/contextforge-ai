/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("standalone package tarball can be installed and executed in clean directory", () => {
  const repoRoot = path.resolve(__dirname, "..");

  // 1. Pack tarball into a temporary destination
  const packTemp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-pack-"));
  const packRes = spawnSync("npm", ["pack", "--pack-destination", packTemp], {
    cwd: repoRoot,
    encoding: "utf-8",
    shell: true,
  });

  assert.equal(packRes.status, 0, `npm pack failed:\n${packRes.stderr || packRes.stdout}`);
  const lines = packRes.stdout.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tarballName = lines.pop();
  const tarballPath = path.join(packTemp, tarballName);
  assert.ok(fs.existsSync(tarballPath), `Tarball must exist at ${tarballPath}`);

  // 2. In a clean, isolated directory, install the tarball with only production dependencies
  const installTemp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-install-"));
  try {
    fs.writeFileSync(
      path.join(installTemp, "package.json"),
      JSON.stringify({ name: "clean-consumer", version: "1.0.0", private: true })
    );

    const installRes = spawnSync("npm", ["install", tarballPath, "--omit=dev"], {
      cwd: installTemp,
      encoding: "utf-8",
      shell: true,
    });
    assert.equal(
      installRes.status,
      0,
      `npm install of tarball failed:\n${installRes.stderr || installRes.stdout}`
    );

    const installedBin = path.join(
      installTemp,
      "node_modules",
      "contextforge",
      "bin",
      "contextforge.js"
    );
    assert.ok(fs.existsSync(installedBin), "Installed contextforge.js binary must exist");

    function runInstalled(cwd, ...args) {
      return spawnSync(process.execPath, [installedBin, ...args], {
        cwd,
        encoding: "utf-8",
        env: {
          ...process.env,
          CONTEXTFORGE_AI_PROVIDER: "mock",
          CONTEXTFORGE_PRIVACY_MODE: "local",
        },
      });
    }

    // 3. Verify contextforge --help from clean installation
    const helpRes = runInstalled(installTemp, "--help");
    assert.equal(helpRes.status, 0, `contextforge --help failed: ${helpRes.stderr}`);
    assert.match(helpRes.stdout, /Local-first AI project memory compiler/);
    assert.match(helpRes.stdout, /init/);
    assert.match(helpRes.stdout, /checkpoint/);
    assert.match(helpRes.stdout, /recall/);

    // 4. In a disposable project subdirectory, run full workflow
    const projectDir = path.join(installTemp, "disposable-app");
    fs.mkdirSync(projectDir);

    // init
    const initRes = runInstalled(projectDir, "init");
    assert.equal(initRes.status, 0, `init failed: ${initRes.stderr}`);
    assert.match(initRes.stdout, /Initialized ContextForge/);

    // checkpoint
    const checkRes = runInstalled(
      projectDir,
      "checkpoint",
      "Use Redis for caching",
      "--kind",
      "decision",
      "--source",
      "lib/cache.ts"
    );
    assert.equal(checkRes.status, 0, `checkpoint failed: ${checkRes.stderr}`);
    assert.match(checkRes.stdout, /Saved: \[decision\]/);

    // remember
    const remRes = runInstalled(
      projectDir,
      "remember",
      "Fixed memory leak in connection pool"
    );
    assert.equal(remRes.status, 0, `remember failed: ${remRes.stderr}`);
    assert.match(remRes.stdout, /Saved note to BUG/);

    // recall
    const recallRes = runInstalled(projectDir, "recall", "caching", "--level", "handoff");
    assert.equal(recallRes.status, 0, `recall failed: ${recallRes.stderr}`);
    assert.match(recallRes.stdout, /Use Redis for caching/);

    // audit
    const auditRes = runInstalled(projectDir, "audit", "--verbose");
    assert.equal(auditRes.status, 0, `audit failed: ${auditRes.stderr}`);
    assert.match(auditRes.stdout, /integrity chain valid/);

    // scan
    const scanRes = runInstalled(projectDir, "scan");
    assert.equal(scanRes.status, 0, `scan failed: ${scanRes.stderr}`);

    // doctor
    const doctorRes = runInstalled(projectDir, "doctor");
    assert.equal(doctorRes.status, 0, `doctor failed: ${doctorRes.stderr}`);

    // capsule
    const capRes = runInstalled(projectDir, "capsule", "setup redis cache");
    assert.equal(capRes.status, 0, `capsule failed: ${capRes.stderr}`);
    assert.match(capRes.stdout, /Context Capsule: setup redis cache/);

    // export
    const expRes = runInstalled(projectDir, "export");
    assert.equal(expRes.status, 0, `export failed: ${expRes.stderr}`);
    assert.match(expRes.stdout, /Wrote AGENTS\.md/);

    // export overwrite protection without --force
    const expGuardRes = runInstalled(projectDir, "export");
    assert.equal(expGuardRes.status, 1, "export should fail without --force when files exist");
    assert.match(expGuardRes.stderr, /Export refused to overwrite existing files/);

    // export with --force
    const expForceRes = runInstalled(projectDir, "export", "--force");
    assert.equal(expForceRes.status, 0, `export --force failed: ${expForceRes.stderr}`);
    assert.match(expForceRes.stdout, /Exported 8 files/);
  } finally {
    fs.rmSync(packTemp, { recursive: true, force: true });
    fs.rmSync(installTemp, { recursive: true, force: true });
  }
});
