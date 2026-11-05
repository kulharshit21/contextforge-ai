# ContextForge Memory Skill: development plan

Maintainer: @kulharshit21
Status: active; deliver work in verified increments. Do not announce public adoption, production readiness, or superiority over built-in compaction without evidence.

## North star

An installable, reusable Agent Skill for **durable project memory and low-noise context handoffs**. It should preserve why changes were made, validated test outcomes, unresolved blockers, architectural constraints, and next actions, without relying on a single conversation window.

The skill cannot replace platform memory or silently intercept native model compaction. Any automatic runtime hooks are optional integrations only where supported and explicitly enabled.

## Architecture

- Agent Skills folder: .agents/skills/contextforge-memory/SKILL.md.
- Portable Python standard-library companion: local journal and deterministic task-based recovery.
- Existing TypeScript CLI: structured Markdown memory, repo scans, drift checks and agent-format exports.
- Optional future adapters: Codex, Claude Code, Cursor, Gemini, OpenAI SDK, MCP (not claimed today).
- Storage remains user-owned and local by default. No cloud calls without explicit opt-in.

## Milestone A — Portable skill and safe handoff (stabilized)

Status: Completed and verified across Linux, macOS, and Windows (PR #19).

Acceptance:
- Agent skill metadata validates against the standard.
- Local journal init/save/recall/audit/repair commands work on Linux/Windows/macOS.
- Records are typed and provenance-aware, corrections are append-only, and memory remains gitignored.
- A task-specific handoff fits a strict size limit, including source references.
- Stale lock auto-recovery and `--break-lock` prevent deadlocks from crashed writers.
- Interrupted writes and trailing corruption are safely recovered via `repair` with timestamped `.bak` files.
- Memory-injection and prompt-tampering patterns are screened and refused.
- Security limitations are explicit; no secret values in test fixtures or documentation.
- CI is green across platforms.

## Milestone B — Integrate with the TypeScript CLI (unified interface)

Status: Completed and verified with bidirectional hash-chain interoperability (PR #20, issue #16).

Acceptance:
- A single documented UX exposes `checkpoint`, `recall`, `audit`, `repair`, `sync`, and context export.
- One canonical schema/migration strategy: binary-compatible SHA-256 hash-chain journal and synchronized Markdown documents.
- Bidirectional sync: Markdown items import to journal without duplication; journal updates reflect in Markdown.
- Agent exports remain collision-safe; explicit consent required before overwriting existing instructions.
- All CLI commands work offline and have verified integration tests.
- 100% interoperability between Python skill script and Node CLI verified in test suite.

## Milestone C — Context management improvements (tiered context)

Status: Completed and verified (PR #20).

Acceptance:
- Tiered context output levels:
  - `handoff`: compact milestone view (immediate blockers, next steps, recent decisions, <=1800 chars).
  - `capsule`: task-focused context view (decisions, architecture, needed/avoid files, errors, <=4500 chars).
  - `evidence`: full provenance view with file existence checks on disk, Git SHA anchors, and timestamps (<=8000 chars).
- Strict budget enforcement with lexical keyword ranking, kind priority weighting, and recency scoring.
- Formats: Markdown and JSON.
- Grounded Git commit anchors automatically captured when available.

## Milestone D — Privacy and security

Status: Completed and verified (PR #19, PR #20, PR #22, issue #2).

Acceptance:
- Threat model for prompt injection, poisoned memory, traversal, symlinks, concurrent writes and secret leakage addressed and tested.
- Tests for malformed records, crash during append, duplicate inputs, invalid paths, injection strings and non-UTF8 passing across all platforms.
- Explicit local/cloud boundaries with consent gates documented and enforced; Next.js dev server bound to loopback `127.0.0.1` by default.
- Dependency audit and vulnerability remediation completed (issue #2): upgraded `simple-git` to `^4.0.2` (resolving critical GHSA-v5rq-49vh-5v5c) and `zod` to `^4.6.7` (resolving high GHSA-mrhx-c7xc-m3w5); added package overrides for `postcss`, `source-map-js`, `nanoid`; runtime reachability and compensating controls documented in `docs/DEPENDENCY_AUDIT.md`.
- No public hosted filesystem editing without authentication and authorization.

## Milestone E — Evaluation and performance

Status: Completed and verified (PR #23, issue #17).

Acceptance:
- Published reproducible benchmark with 30 held-out multi-session tasks across 15 domains in `benchmarks/fixtures/tasks.json` with human-labelled required facts.
- Measured critical-fact retention (with 95% confidence intervals), evidence citation fidelity, prompt injection resistance, stale info leakage, recovery latency, and context usage against equal-budget naive recency and uniform sampling baselines in `benchmarks/run_benchmark.py`.
- Under 1200 chars: ContextForge achieved 86.0% (±5.9%) recall and 84.7% citation fidelity with 1/30 injection leak (vs 44.7% recall, 0% citation, and 30/30 injection leaks for naive recency).
- Comprehensive results and negative/neutral case analyses published in `docs/BENCHMARK_RESULTS.md` without fabricated claims or inflated comparisons.
- Added CI regression test gate `tests/benchmark.test.cjs` and `npm run benchmark` script.

## Milestone F — Community distribution

Status: Completed and verified (PR #24, PR #25, issues #12, #14).

Acceptance:
- Cross-platform verification on Windows 11 and macOS documented in `docs/platforms/WINDOWS_VERIFICATION.md` and `docs/platforms/MACOS_VERIFICATION.md` with sanitized terminal logs, process liveness details, and filesystem case-sensitivity handling.
- Standalone npm CLI packaging prepared (issue #14): strict `"files"` whitelist in `package.json` reducing packed archive from 143 files (689 kB) to 51 clean files (197 kB); standard relative imports across `cli/` and `lib/` resolving module resolution when installed in `node_modules`.
- Clean-install tarball integration test automated in `tests/tarball_install.test.cjs`.
- Gated publish workflow in `.github/workflows/publish.yml` with manual dispatch, default dry-run, and environment approval protections.
- Maintained `"private": true` and documented full release procedure in `docs/RELEASE_CHECKLIST.md` requiring explicit maintainer sign-off before publishing.

## Cadence for Codex

Work one milestone at a time; one reviewable PR per independent logical change. Each PR must show its test plan and actual results. Stop to repair CI before starting the next slice. Prefer small reviewable diffs over large refactors. Every change affecting storage must contain migration/rollback and data-loss checks. Before requesting a merge, show the exact commit SHA, passing checks, open security concerns, and whether user-visible behavior changed. Merge to main only after all required checks pass; never force-push main. Do not delete branches with open pull requests.

## Active engineering issues

All core milestone issues resolved via peer-reviewed, CI-verified PRs:
- #2 dependency-security audit (resolved in PR #22)
- #12 Windows/macOS end-user testing (resolved in PR #24)
- #13 classification and drift regression coverage (resolved in PR #21)
- #14 verified npm CLI packaging (resolved in PR #25)
- #16 unified memory interface (resolved in PR #20)
- #17 reproducible context-retention benchmark (resolved in PR #23)

Pending final hardening:
- #18 Protect main with an enforced GitHub branch ruleset after Codex finishes

See references/design.md under the agent skill for the current experimental retrieval contract.
