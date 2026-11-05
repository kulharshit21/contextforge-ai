# ContextForge

**Local-first project memory for AI coding agents.** Keep decisions, known bugs, architecture, and setup notes in versioned Markdown, then create task-specific context capsules for Codex, Cursor, Claude, Copilot, Gemini, and other assistants.

[![CI](https://github.com/kulharshit21/contextforge-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/kulharshit21/contextforge-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Git records *what* changed. ContextForge helps preserve *why*.

**Project status:** early-stage open-source MVP. The repository contains a local CLI, dashboard, mock/offline functionality, and CI checks. It is **not yet published to npm**. Some features described in the roadmap are proposals, not shipped features.

## Unified memory architecture

ContextForge combines two synchronized storage formats:

1. **Append-only journal (`.contextforge/agent-memory/events.jsonl`)**: A tamper-evident, SHA-256 hash-chained ledger storing discrete decisions, bugs, tests, blockers, next steps, facts, and handoffs with Git SHA and file anchors.
2. **Structured Markdown (`.contextforge/*.md`)**: Human-readable, versioned documents (`DECISIONS.md`, `ARCHITECTURE.md`, `CURRENT_TASKS.md`, `BUGS_AND_FIXES.md`, etc.) for direct editing and agent indexing.

Both the TypeScript Node CLI and the zero-dependency Python Agent Skill share the exact same hash-chain contract and storage format. A checkpoint made in the CLI is immediately verifiable by the Python skill, and vice versa.

### Agent skill: local memory checkpoints and context recovery

A portable, open-format agent skill is located at
[.agents/skills/contextforge-memory/SKILL.md](.agents/skills/contextforge-memory/SKILL.md).

An AI coding agent can use this skill to:

- record compact **decisions, test outcomes, bugs, blockers, and next actions** with evidence references;
- recover task-relevant records via tiered context budgets (`handoff`, `capsule`, or `evidence`);
- preserve corrections without silently changing earlier history;
- verify and repair the local append-only journal after interrupted sessions.

It does **not** intercept or replace built-in AI compaction, autonomously monitor all chats, or claim better benchmark performance than native model memory. Its retrieval is deterministic and keyword-based; agent-written notes still need verification.

### Quick start (CLI)

**Requirements:** Node.js 24 (CI target), npm, and Git for full repository metadata. Linux, macOS, and Windows are supported.

~~~bash
git clone https://github.com/kulharshit21/contextforge-ai.git
cd contextforge-ai
npm ci
npm link
contextforge --help
~~~

Now run the linked CLI from a **different project directory** (not the ContextForge source repository):

~~~bash
cd /path/to/your-project
contextforge init
contextforge checkpoint "Selected SQLite for local storage" --kind decision --source docs/ARCHITECTURE.md
contextforge checkpoint "Blocker: need Windows CI test" --kind blocker
contextforge recall --level handoff --budget-chars 1500
contextforge scan
contextforge capsule "Add robust error handling"
contextforge doctor
contextforge audit --verbose
contextforge export --all
contextforge stats
~~~

On Windows, replace the example directory with the path to your target project in PowerShell. The command runs in the directory from which you invoke it and creates local files under that project's `.contextforge/` folder. Export refuses to overwrite existing instruction files by default. **Review and back up files before passing `--force`**.

### Platform verification & empirical benchmarks

See our verified platform walkthroughs with exact commands, exit codes, and sanitized logs:
- [Windows 11 CLI Verification](docs/platforms/WINDOWS_VERIFICATION.md)
- [macOS CLI Verification](docs/platforms/MACOS_VERIFICATION.md)
- [Context-Retention Benchmark Report (Issue #17)](docs/BENCHMARK_RESULTS.md)
- [Dependency Security Audit & Triage (Issue #2)](docs/DEPENDENCY_AUDIT.md)

**Why not npx?** This package is currently marked private and is not published. Do not use the unverified command `npx contextforge` from the public npm registry. Until an audited package release is published, use `npm link` or run `node /path/to/contextforge-ai/bin/contextforge.js` from your target project.

## Local dashboard

~~~bash
cd contextforge-ai
npm ci
npm run dev
~~~

Visit http://127.0.0.1:3000. The development and production start scripts bind to loopback by default because the app has local filesystem-backed endpoints and **does not yet implement multi-user authentication**. Do not expose it on a public server or untrusted network.

With no cloud credentials, you can explore the seeded demo and local workspace. Vercel deployments show a read-only demo rather than persisting local workspace files.

## CLI reference

| Command | Purpose |
| --- | --- |
| `contextforge init` | Initialize structured local memory and append-only event journal |
| `contextforge checkpoint <text>` | Save a typed, provenance-backed memory checkpoint (synced to Markdown) |
| `contextforge recall [task]` | Restore task context across tiers: `--level handoff\|capsule\|evidence` |
| `contextforge audit` | Validate hash-chain integrity, kind breakdown, and lock status |
| `contextforge repair` | Safely recover from crashed writes or stale locks with timestamped `.bak` |
| `contextforge sync` | Synchronize Markdown memory files with the event journal |
| `contextforge remember "note"` | Store a note in an inferred section and journal |
| `contextforge ingest-chat ./notes.txt` | Extract memory from local text |
| `contextforge scan` | Refresh repository metadata and Git facts |
| `contextforge capsule "task"` | Save a task-specific context capsule |
| `contextforge doctor` | Report likely inconsistencies or drift |
| `contextforge export --all` | Generate agent instructions without overwriting existing files; `--force` allows intentional replacement |
| `contextforge stats` | Inspect local workspace summary and journal counts |
| `contextforge ui` | Show dashboard startup steps |

## Design and privacy

- The source of truth is local Markdown under `.contextforge/` and verified journal events.
- The default provider is mock; no remote LLM is required.
- `CONTEXTFORGE_PRIVACY_MODE=local` blocks Gemini through the provider resolver.
- To intentionally use a cloud model, review data handling and set `CONTEXTFORGE_PRIVACY_MODE=cloud` plus provider credentials. **Do not upload private source or chats without permission.**
- Repo scans may include paths, Git author names, and commit messages. Inspect them before sharing.
- Files in `.contextforge/`, `workspaces/`, and local environment files are ignored by Git by default.

See [.env.example](.env.example), [architecture](docs/ARCHITECTURE.md), [demo walkthrough](docs/README_DEMO.md), and [security policy](SECURITY.md).

## Quality checks

~~~bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
python -m unittest discover -s tests -p "test_*.py" -v
~~~

CI runs these checks plus a CLI smoke test across Linux, macOS, and Windows. A green status applies only to the current commit; see GitHub Actions for evidence.

## Contribute

Contributions are welcome, especially Windows/macOS verification, parser and drift edge cases, documentation clarity, and security review. Start with [CONTRIBUTING.md](CONTRIBUTING.md), open a reproducible issue, and send a focused PR. Be respectful and avoid uploading real secrets or confidential transcripts.

- [Issues](https://github.com/kulharshit21/contextforge-ai/issues)
- [Pull requests](https://github.com/kulharshit21/contextforge-ai/pulls)
- [Security reporting](SECURITY.md)
- [Changelog](CHANGELOG.md)

## Roadmap (not shipped)

- Audited npm distribution with a self-contained CLI bundle
- Complete cross-platform testing and automated versioned releases
- Preview/approval workflows for every generated memory change
- Richer GitHub PR/issue ingestion and opt-in integration
- Optional auth and cloud sync
- Actual MCP server (today only the manifest export exists)

## License

[MIT](LICENSE). Maintained by [@kulharshit21](https://github.com/kulharshit21). Early-stage project; feedback and real usage reports are appreciated.
