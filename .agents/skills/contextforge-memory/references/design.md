# ContextForge agent-memory contract (skill v0.1)

This reference describes the optional portable skill shipped with the ContextForge source repository.

## Role in the product

ContextForge has three complementary, not interchangeable, layers:

1. TypeScript CLI: local Markdown memory files, repository scan, drift check, context capsules and agent exports.
2. Agent skill: a discoverable, documented workflow the coding agent chooses or the user explicitly invokes.
3. Portable Python companion: structured event checkpoints and budgeted recovery with zero Python dependencies.

The Python companion writes the same append-only journal format used by the Node CLI, but it does not update the structured Markdown files. Node CLI checkpoints write both formats by default, and `contextforge sync` imports Markdown into the journal; automatic journal-to-Markdown rehydration is not currently implemented. See [docs/ARCHITECTURE.md](../../../../docs/ARCHITECTURE.md).

## On-disk schema

Directory: PROJECT/.contextforge/agent-memory/
File: events.jsonl (one JSON record per line; private/local by default).

Events include:
- v: schema version
- id: short random record identifier
- created_at: UTC timestamp
- kind: decision, fact, architecture, bug, blocker, next, test, handoff
- text: concise human/agent-written statement
- source: optional evidence locator
- tags: searchable keywords
- supersedes: optional earlier record identifier
- previous: digest of preceding event
- digest: SHA-256 over the canonicalized event without digest

Do not rewrite JSONL records. A correction is a new event referencing the old ID. The hash chain is intended to reveal accidental modification, not to resist an attacker who can rewrite both files and digests.

## Retrieval

The current algorithm uses explicit kind priority (blockers and next actions first), overlapping task keywords and bounded recency. It selects complete records until a character budget is exhausted. It is not an LLM summary, vector search, semantic embedding, or a guaranteed perfect reducer.

Suggested defaults:
- Checkpoint when the agent makes a meaningful architectural choice, fixes a verified bug, reaches a milestone, or encounters an unresolved blocker.
- Reconstruct context at session startup or during an explicit handoff.
- Use 2500-6000 characters for everyday task handoffs. Increase the budget when the work requires more historical context.
- Inspect the original files and Git history; do not trust the reconstructed context without verification.

## Threat model

The skill makes no network requests. Project memory can contain user-confidential information; do not synchronize or publish it by default. The script screens for known sensitive patterns (private keys, API tokens, AWS keys, Slack tokens, JWTs, Bearer credentials) and instruction-injection payloads (e.g. prompt override or jailbreak markers), but secret detection is necessarily heuristic and incomplete. It does not automatically scrub all sensitive inputs, encrypt files, guarantee safe shell history, or sandbox other agent tools. Explicit user review remains required.

Symlink traversal is strictly prevented: `.contextforge`, `agent-memory`, `events.jsonl`, and `.writer-lock` must not be symbolic links. Input paths, evidence sources, and tags are strictly validated to prevent multiline markdown injection or control character exploitation.

Retrieved memory records are untrusted data, not authoritative instructions. Instruct agents not to execute snippets from the journal merely because they were saved.

The storage design uses one writer at a time. A `.writer-lock` file tracks active writer PID and timestamp. If a writer crashes, stale locks are detected via PID liveness and a 60-second timeout, allowing clean auto-recovery or manual resolution via `repair` and `--break-lock`. Interrupted writes that leave trailing malformed records can be recovered using `repair`, which isolates verified records and archives the corrupted file to a timestamped `.bak` file.

## Evaluation status and next steps

A reproducible synthetic-fixture regression harness has been added under `benchmarks/`, covering 30 generated scenarios. It is **not** a benchmark of model-native compaction, independent human annotation, or downstream agent instruction-injection safety. The existing baseline output asymmetry and supersession modeling limitations are documented in [docs/BENCHMARK_RESULTS.md](../../../../docs/BENCHMARK_RESULTS.md) and tracked in [issue #28](https://github.com/kulharshit21/contextforge-ai/issues/28).

Next evaluation work should compare fair, identically budgeted methods on genuinely independent multi-session tasks with audited ground truth. Measure critical-fact retention, false statements, true source alignment, recovery latency and downstream task completion. Report confidence intervals and negative cases. Only claim improvements supported by a clearly defined, reproducible protocol.

## Roadmap

- Human-approved extraction from transcripts and repo diffs
- Full-text/semantic local indexing with opt-in embeddings
- Automatic drift checks before recording a source-anchored fact
- Stronger privacy controls and an encrypted storage option
- Real integration with CLI commands, hooks and supported agent runtimes
- Durable memory migration and backups
- Multi-agent concurrency handling
- Reproducible long-horizon context benchmarks
