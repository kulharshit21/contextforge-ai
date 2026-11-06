# Changelog

This project follows the general structure of Keep a Changelog. Versions below are milestones, not proof that an npm package has been published.

## Unreleased

- Closed memory data-loss paths in the Node engine (verified by reproduction):
  - `contextforge repair` now holds the journal writer lock across its entire read→backup→rebuild sequence and swaps the rebuilt journal in atomically. Previously the backup-rename window left `events.jsonl` absent; an append committed in that gap was silently overwritten (reproduced: the committed event existed in neither the journal nor the backup).
  - `contextforge ingest-chat` (and dashboard chat ingest) now journal every extracted entry in addition to the Markdown mirror. Recall reads only the journal, so previously ingested memories were invisible to `recall` until a manual `sync`, and any item aged out of the mirror's 50-item-per-file cap was permanently lost.
  - Markdown mirror updates now hold the writer lock; concurrent writers surface a clear "Memory writer lock exists" error instead of silently overwriting each other's entries (last-writer-wins data loss).
  - Hand-edited memory files containing unquoted YAML timestamps (`updated_at: 2026-11-06`) no longer crash every memory command with a raw ZodError; dates are normalized to ISO strings.
  - `contextforge sync` now counts only journal events actually created and de-duplicates by text across memory files, so identical content in two files no longer produces two journal events.

- Hardened dashboard API filesystem boundaries (local, unauthenticated endpoints):
  - `PUT /api/memory` now validates `fileKey` at runtime with zod. Previously a request with a traversal value such as `../../../../name` (accepted despite the TypeScript union type) could write attacker-controlled `.md` files outside the project workspace, including overwriting unrelated repositories' agent instruction files.
  - `saveMemoryFile`/`saveMemoryFileRaw` reject unknown memory file keys before path construction, closing the same hole for any non-HTTP caller.
  - `PUT /api/projects/scan` no longer scans arbitrary filesystem paths through `localPathHint`: scan targets must exist, must not be symlinks, and must stay inside the dashboard checkout unless `CONTEXTFORGE_ALLOW_EXTERNAL_SCAN=1` is set. Previously the endpoint disclosed file listings, README content, and git history of any directory on disk.
  - Scan-root validation compares canonical `realpath` paths on both sides, so a symlinked parent inside the checkout can no longer smuggle a canonically-outside directory past the lexical containment check, and the scanner reads exactly the validated canonical path.
  - The repository scanner verifies that every matched file resolves inside the scan root before listing or reading it (fast-glob still descends into Windows junctions even with `followSymbolicLinks: false`), so internal symlinks cannot leak content from outside the validated root. Direct root-level reads (README.md, package.json, `.contextforgeignore`) refuse symlinks instead of following them, and git metadata is only read from a real `.git` directory resolving inside the root — a symlinked `.git` or a worktree-style gitdir pointer to another repository reports unknown git facts instead of disclosing that repository's branch and history. Opt-in external scans now record a visible warning in the scan result.
  - `POST /api/projects` now type-checks `repoUrl`/`localPathHint` so non-string values cannot poison `workspaces/projects.json` and break project listing.
  - Added regression tests in `tests/api-path-safety.test.cjs`.

- Refined benchmark evaluation methodology and addressed issue #28:
  - Ensured fair baseline source accounting by formatting and budgeting `(source: ...)` within baseline character allocations, eliminating artificial 0% citation rates (recency now achieves 58.7% and uniform achieves 76.7% source-string presence at 1,200 chars).
  - Implemented explicit superseding links (`supersedes_event_idx`) across multi-session fixtures and verified active hash-chain record invalidation during retrieval.
  - Renamed injection leakage metric to `suspicious_payloads_emitted` ("Suspicious text") with clear documentation that exact keyword matching does not measure agent vulnerability to execution.
  - Added unit test coverage for benchmark harness workspace creation and supersession linking in `tests/test_benchmark_harness.py`.
  - Updated `docs/BENCHMARK_RESULTS.md` with updated empirical results, negative case analyses (2/30 cases), and honest scope definitions.

- Added Agent Skill lifecycle commands (`contextforge skill status`, `install`, `uninstall`):
  - `status`: inspects whether `contextforge-memory` is installed project-locally or globally, verifies presence of `SKILL.md`, Python companion script, and design references, and detects Python 3 runtime availability.
  - `install`: installs the portable skill into `.agents/skills/contextforge-memory` (or user-global `~/.agents/skills/`), enforcing overwrite protection unless `--force` is supplied.
  - `uninstall`: removes the installed skill and cleans up empty parent directories up to `.agents/`.
  - Added full automated integration tests across local install, overwrite guards, direct script invocation in target project, and clean uninstallation in `tests/cli.integration.test.cjs` and `tests/tarball_install.test.cjs`.

- Upgraded Next.js to 16.4.5 and resolved GHSA-8h8q-6873-q5fj (issue #32):
  - Upgraded `next` to `^16.4.5` and `eslint-config-next` to `^16.4.5`, resolving high-severity Server Components DoS (GHSA-8h8q-6873-q5fj), cache poisoning, SSRF, and upstream `sharp` vulnerabilities.
  - Added package override for `js-yaml` (`^3.15.2`), resolving quadratic-complexity CPU consumption DoS in `gray-matter`.
  - Reduced `npm audit --omit=dev` vulnerabilities to 4 total (0 critical, 0 direct production vulnerabilities).
  - Updated `docs/DEPENDENCY_AUDIT.md`, `SECURITY.md`, and `README.md` to document the upgrade and hosted/local runtime security boundaries.

### Documentation and reliability review (November 2026)

- Made README.md a concise project front door, with a separate source-install guide and documentation index.
- Corrected the journal/Markdown synchronization description and expanded the Agent Skill's architecture reference.
- Reclassified benchmark percentages as preliminary synthetic-fixture regression results; recorded methodology defects and correction plan in issue #28.
- Clarified contribution and AI-assisted review expectations, without fabricating contributors or verification.
- Added EditorConfig for consistent line endings and basic formatting.


- Updated development build plan and maintainer documentation:
  - Documented completion of Milestones D, E, and F in `docs/AGENT_SKILL_BUILD_PLAN.md` with links to PRs #19, #20, #21, #22, #23, #24, #25 and closed issues #2, #12, #13, #14, #16, #17.
  - Documented main branch ruleset and protection policy in `CONTRIBUTING.md` and `docs/MAINTAINER_RUNBOOK.md`.

- Standalone npm CLI packaging and release preparation (issue #14):
  - Configured explicit `"files"` manifest in `package.json`, reducing packed tarball from 143 files (689 kB unpacked) down to 51 files (197 kB unpacked) and strictly excluding private Next.js app pages, UI components, and benchmark fixtures.
  - Refactored `cli/` and `lib/` to use standard relative module imports, resolving runtime module resolution failures when installed inside `node_modules`.
  - Added automated integration test `tests/tarball_install.test.cjs` verifying tarball packaging, isolated clean-directory installation with `--omit=dev`, and CLI execution across `init`, `checkpoint`, `remember`, `recall`, `audit`, `scan`, `doctor`, `capsule`, and `export`.
  - Added `.github/workflows/publish.yml` with manual `workflow_dispatch` trigger, dry-run by default, and `release-approval` environment protection.
  - Updated `docs/RELEASE_CHECKLIST.md` with release criteria and verification status.

- Cross-platform quickstart verification on Windows 11 and macOS (issue #12):
  - Executed end-to-end disposable project walkthrough on Windows 11 (PowerShell, Node 24) verifying `init`, `checkpoint`, `remember`, `recall`, `audit`, `scan`, `doctor`, `capsule`, and `export`.
  - Confirmed deterministic output paths, expected exit codes, and overwrite protection behavior for `AGENTS.md`.
  - Authored `docs/platforms/WINDOWS_VERIFICATION.md` and `docs/platforms/MACOS_VERIFICATION.md` with sanitized terminal logs, process liveness details, and filesystem case-sensitivity notes.
  - Linked platform verification docs in `README.md`.

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
