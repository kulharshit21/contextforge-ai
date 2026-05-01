#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");

const packageRoot = path.join(__dirname, "..");
const entrypoint = path.join(__dirname, "..", "cli", "index.ts");
const tsxImport = pathToFileURL(
  require.resolve("tsx", { paths: [packageRoot] }),
).href;
const result = spawnSync(
  process.execPath,
  ["--import", tsxImport, entrypoint, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    cwd: process.cwd(),
    env: {
      ...process.env,
      TSX_TSCONFIG_PATH: path.join(packageRoot, "tsconfig.json"),
    },
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
