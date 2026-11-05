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

Status: Completed and verified across Linux, macOS, and Windows.

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

## Milestone B — Integrate with the TypeScript CLI

Acceptance:
- A single documented UX exposes checkpoint, recall, review and context export.
- One canonical schema/migration strategy; avoid hidden duplicated sources of truth.
- Import existing .contextforge Markdown data without destructive conversion.
- Agent exports remain collision-safe; explicit consent required before overwriting existing instructions.
- All CLI commands work offline and have integration tests.
- CLI packaging/installation is tested from an actual generated tarball, not a private source checkout.

## Milestone C — Reliable memory lifecycle

Acceptance:
- An explicit checkpoint routine for major decisions, tests, bugs, blockers and next actions.
- Stale references flagged with repository evidence (Git SHA/path existence/optional code references).
- Provenance confidence and superseding records; reviewer approval for inferred facts.
- Bounded retention, archives and migrations; backups with restore tests.
- No claim of automatic perfect recall.

## Milestone D — Privacy and security

Acceptance:
- Threat model for prompt injection, poisoned memory, traversal, symlinks, concurrent writes and secret leakage.
- Tests for malformed records, crash during append, duplicate inputs, invalid paths, injection strings and non-UTF8.
- Explicit local/cloud boundaries with consent gates.
- Dependency audit and remediation logged in issue #2.
- No public hosted filesystem editing without authentication and authorization.

## Milestone E — Evaluation and performance

Acceptance:
- Publish reproducible multi-session software-development tasks with human-labelled required facts.
- Measure critical-fact retention, false facts, task completion, source accuracy, recovery latency and context usage.
- Compare equal-budget tail truncation, ContextForge deterministic retrieval, and any available model compaction baseline.
- Do not claim improvement until statistical evidence supports the claim, and report negative results.

## Milestone F — Community distribution

Acceptance:
- Cross-platform installation and minimal dependency footprint.
- Real redacted demo recordings and sample projects; documented API stability.
- Contributor onboarding, issue triage, code review, changelog and security reporting maintained.
- Optional installable package released only after maintainer sign-off and clear licensing.
- Demonstrated genuine external use; no purchased stars, fake downloads or vanity PRs.

## Cadence for Codex

Work one milestone at a time; one reviewable PR per independent logical change. Each PR must show its test plan and actual results. Stop to repair CI before starting the next slice. Prefer small reviewable diffs over large refactors. Every change affecting storage must contain migration/rollback and data-loss checks. Before requesting a merge, show the exact commit SHA, passing checks, open security concerns, and whether user-visible behavior changed. Merge to main only after all required checks pass; never force-push main. Do not delete branches with open pull requests.

## Active engineering issues

- #2 dependency-security audit
- #12 Windows/macOS end-user testing
- #13 classification and drift regression coverage
- #14 verified npm CLI packaging
- #16 unified memory interface
- #17 reproducible context-retention benchmark

See references/design.md under the agent skill for the current experimental retrieval contract.
