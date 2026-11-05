# Changelog

This project follows the general structure of Keep a Changelog. Versions below are milestones, not proof that an npm package has been published.

## Unreleased

- Reproducible context-retention benchmark against equal-budget baselines (issue #17):
  - Curated 30 held-out multi-session engineering scenarios in `benchmarks/fixtures/tasks.json` with human-verified gold facts across 15 technical domains.
  - Built standalone evaluator `benchmarks/run_benchmark.py` testing critical-fact recall (with 95% confidence intervals), evidence citation fidelity, injection resistance, stale info leakage, and retrieval latency against naive recency truncation and uniform sampling under identical character budgets.
  - Published comprehensive results and negative case analysis in `docs/BENCHMARK_RESULTS.md`, reporting empirical tradeoffs without fabricated claims.
  - Added automated CI regression gate `tests/benchmark.test.cjs` asserting >=80% critical fact recall and prompt injection neutralization.
  - Added `npm run benchmark` script.

- Dependency vulnerability audit and triage (issue #2):
  - Upgraded `simple-git` to `^4.0.2` resolving critical vulnerability GHSA-v5rq-49vh-5v5c (`VISUAL` editor omission) and command injection vectors in `@simple-git/argv-parser`. Refactored git calls to use named exports and strict typing.
  - Upgraded `zod` to `^4.6.7` resolving high severity vulnerability GHSA-mrhx-c7xc-m3w5 (collection parsing memory exhaustion).
  - Added package overrides for `postcss` (`^8.5.32`), `source-map-js` (`^1.2.2`), and `nanoid` (`^3.3.20`), eliminating path traversal and DoS advisories.
  - Authored comprehensive dependency triage in `docs/DEPENDENCY_AUDIT.md` analyzing runtime reachability and documenting compensating controls for all remaining transitive advisories.

- Added focused regression test suite for note classification and drift detection (issue #13):
  - Covered deterministic classification precedence across mixed decision/API, bug/feature, failed attempts, and privacy rules.
  - Covered drift detection for missing scripts, framework mismatches, deleted paths, and undocumented environment variables.
  - Added tests/fixtures/README.md documenting classifier precedence, regex tradeoffs, and offline limitations.

- Unified memory interface across TypeScript CLI and Python agent-memory skill:
  - Implemented `lib/memory/journal.ts` with 100% SHA-256 hash-chain and JSONL binary compatibility with the Python skill engine.
  - Implemented `lib/memory/tiered-context.ts` supporting three context recovery tiers: `handoff` (compact), `capsule` (standard), and `evidence` (provenance-backed with file existence and Git SHA anchors).
  - Added new CLI commands: `checkpoint` (alias `save`), `recall`, `audit`, `repair`, and `sync`.
  - Harmonized journal events with structured Markdown files (`DECISIONS.md`, `CURRENT_TASKS.md`, `BUGS_AND_FIXES.md`, etc.) to prevent dual-source drift.
  - Updated `remember` to record into both the append-only journal and structured Markdown.
  - Added end-to-end integration tests verifying bidirectional hash-chain interoperability between Python and Node runtimes.
  - Added CLI smoke test coverage for `checkpoint`, `recall`, and `audit` in GitHub Actions CI.
- Hardened Python agent memory engine (`contextforge-memory`):
  - Stale lock detection with PID liveness verification across Windows, Linux, and macOS.
  - Added `repair` CLI command to recover from stale locks and safely truncate corrupted trailing records with automatic timestamped `.bak` backups.
  - Added `--break-lock` flag to `save` and `repair` for forced recovery of abandoned writer locks.
  - Enhanced `audit` command with `--verbose` kind breakdown and lock status reporting.
  - Added UTF-8 BOM (`utf-8-sig`) handling and empty line tolerance for cross-platform resilience.
  - Strengthened secret detection with AWS access keys, GitHub PATs, Slack tokens, JWTs, and Bearer tokens.
  - Added instruction-injection screening against prompt overrides and jailbreak attempts.
  - Added input sanitization against control characters and multiline injection in evidence source fields.
  - Prevented symlink traversal across storage directories and lock files.
  - Added 6 new unit tests covering crash recovery, stale locks, injection prevention, and cross-platform formatting.
- Clarified CLI installation and project maturity in documentation.
- Added contributor/security guidelines and review templates.
- Added CLI integration testing to CI.
- Improved CLI failure exit codes and error handling.
- Prevented repeat capsule generation from overwriting same-day results.
- Added project import validation and duplicate-project protection.
- Default local dashboard binding changed to loopback.

## 0.1.0 — Initial MVP (source repository)

- Local structured project memory, repo scans, capsule generation, drift checks, and agent exports.
- Next.js dashboard with seeded demo data.
- Mock, Gemini, and Ollama provider integration code.

No stable API or public npm release is promised at this stage.
