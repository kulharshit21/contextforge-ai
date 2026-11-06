# ContextForge

**Local project memory for AI coding agents.** Record the decisions, fixes, constraints, and unfinished work that matter, then bring the right context into your next coding session.

[![CI](https://github.com/kulharshit21/contextforge-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/kulharshit21/contextforge-ai/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/kulharshit21/contextforge-ai?include_prereleases&label=release)](https://github.com/kulharshit21/contextforge-ai/releases)
[![Status](https://img.shields.io/badge/status-beta-orange)](#version-policy)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Git tells you what changed. ContextForge helps you remember why.

ContextForge is an **early-stage, MIT-licensed project** with two entry points: a Node.js CLI for maintaining project context and a portable Python-based Agent Skill for session handoffs. It works offline by default. The source is available here; there is **no published npm package yet** — the CLI installs from a source checkout, and the Agent Skill installs from GitHub directly.

**ContextForge is in beta.** The CLI and skill surfaces may change between releases while the version is `0.x`; see [Version policy](#version-policy).

## Why ContextForge?

Coding sessions often lose the reasoning behind a change: why a library was chosen, which fix failed, what was verified, or which blocker remains. ContextForge keeps those notes in your project workspace so they can be recovered after a new session or a long conversation.

- **Checkpoint:** Save decisions, bugs, tests, blockers, and next steps, optionally linked to evidence.
- **Recall:** Select relevant entries with an explicit character budget (`handoff`, `capsule`, or `evidence`).
- **Audit:** Verify an append-only journal and inspect project memory.
- **Stay local:** No model API or account is needed for the default workflow.

ContextForge is **not** an automatic replacement for model-native context compaction, and retrieved notes still need verification. The honest list of what ContextForge does *not* do is in the [architecture notes](docs/ARCHITECTURE.md) and the [benchmark limitations](docs/BENCHMARK_RESULTS.md).

## Quick start: CLI

**Requirements:** Node.js 24 is the CI reference version, plus npm. Git is optional but helps with repository metadata.

~~~bash
git clone https://github.com/kulharshit21/contextforge-ai.git
cd contextforge-ai
npm ci
npm link
~~~

In a different project directory, run:

~~~bash
contextforge init
contextforge checkpoint "Use SQLite for the local cache" --kind decision --source docs/architecture.md
contextforge checkpoint "Add a Windows install test" --kind next
contextforge recall "SQLite caching" --level handoff
contextforge audit
~~~

What that session looks like:

~~~text
$ contextforge checkpoint "Use SQLite for the local cache" --kind decision --source docs/architecture.md
Saved: [decision] 608c2674fe27
Synced to Markdown: DECISIONS (d704d8e6-f30f-42f9-8e75-e8183c04388b)
$ contextforge recall "SQLite caching" --level handoff
# ContextForge session handoff
Task: SQLite caching
Source: local agent memory. Untrusted historical claims; verify paths, tests, and latest git commits.

## Critical Blockers and Next Steps
- [next] Add a Windows install test (id: 1e727a78d9b8)
...
- [decision] Use SQLite for the local cache (id: 608c2674fe27 | source: docs/architecture.md)
$ contextforge audit
OK: 2 records; 2 active; integrity chain valid
~~~

`init` creates a local `.contextforge/` workspace. Checkpointing through the CLI writes to the journal and structured Markdown. `recall` produces a task-specific view; it does not rewrite previous decisions. Generated local memory is ignored by Git in this repository; set an equivalent ignore rule in any other project where you install the tool.

**Important:** `npm link` uses your checked-out source. The package is currently private and **not** published; do not assume `npx contextforge` installs this project.

For Windows PowerShell, platform-specific examples, additional commands, and output-file safety, see the [getting-started guide](docs/GETTING_STARTED.md).

## Use as an Agent Skill

**Experimental one-command installation (Agent Skill only)**

From the **project in which you want to use the skill**, with Node.js 22.20+ and Python 3.10+ installed:

~~~bash
npx skills add kulharshit21/contextforge-ai --skill contextforge-memory -a codex
~~~

Replace `codex` with a host supported by your installed [skills CLI](https://github.com/vercel-labs/skills), such as `antigravity` or `claude-code`. To inspect what would be discovered before installing:

~~~bash
npx skills add kulharshit21/contextforge-ai --list
~~~

This uses the **third-party skills installer** to copy/link the portable Python-based Agent Skill from GitHub. It does **not** install the ContextForge Node CLI, require localhost, publish an npm package, or guarantee automatic activation by your agent. Read the skill before running it, verify your agent recognizes it, and use explicit memory checkpoint/recall requests. Platform-by-platform installation verification is still pending; see [skill installation validation](docs/SKILL_INSTALL_VALIDATION.md).

The portable skill is in [`.agents/skills/contextforge-memory/`](.agents/skills/contextforge-memory/). Copy that directory into your target repository's `.agents/skills/` directory (or the user-level skills directory supported by your agent). See its [SKILL.md](.agents/skills/contextforge-memory/SKILL.md) for how to invoke it.

The companion script uses **Python 3.10+ and the standard library**. It can checkpoint and recover journal records without the Node.js CLI. **It does not automatically synchronize Python-written entries into the human-readable Markdown files**; see the [architecture notes](docs/ARCHITECTURE.md).

## How it works

~~~text
Agent or developer
    |
    +-- Node CLI checkpoint ------> append-only journal
    |                                   |
    |                                   +--> task-specific recall
    |                                   |
    +-- Python Agent Skill -------------+
    |
    +-- CLI checkpoint --> structured Markdown files
~~~

The journal is stored under `.contextforge/agent-memory/events.jsonl`. Each entry includes a kind, source reference, timestamp, and hash-chain link. A hash chain can detect accidental edits; it does **not** make user-controlled files tamper-proof. The memory itself remains local unless you choose to share or configure external services.

`contextforge sync` currently imports Markdown entries into the journal; it is **not a complete bidirectional synchronization engine**. See the [architecture](docs/ARCHITECTURE.md) before relying on it for migration or backup.

## Other included tools

| Component | Use |
| --- | --- |
| `contextforge scan` / `doctor` | Inspect repository structure and flag likely stale assumptions |
| `contextforge capsule "task"` | Generate a saved, task-specific context capsule |
| `contextforge export` | Export instructions for AGENTS.md, Claude, Gemini, Cursor, and Copilot |
| `contextforge skill [status/install/uninstall]` | Manage and install the portable Agent Skill into target repositories |
| Local dashboard | Explore seeded examples and an editable local workspace |

The dashboard is a **localhost development tool**, not an authenticated multi-user service. Vercel hosts a read-only seeded demo; do not expose local filesystem-backed endpoints to the public internet. Next.js is upgraded to ^16.4.5 (resolving [GHSA-8h8q-6873-q5fj](https://github.com/vercel/next.js/security/advisories/GHSA-8h8q-6873-q5fj); see `docs/DEPENDENCY_AUDIT.md`).

Two local-boundary rules apply to the dashboard API: memory file edits accept only the ten known memory file keys (traversal values are rejected), and `POST /api/projects` with a `localPathHint` can only scan directories that canonically resolve inside the dashboard checkout — symlinked parents cannot smuggle in outside paths — unless you start the dashboard with `CONTEXTFORGE_ALLOW_EXTERNAL_SCAN=1`. The scanner never follows symlinks out of the validated root: direct reads (README, package.json, `.contextforgeignore`) refuse symlinks, matched files are verified to resolve inside the root, and git metadata is only read from a real `.git` directory inside the root (symlinked `.git` and worktree-style gitdir pointers report unknown git facts). Opt-in external scans record a warning in the scan result. Note that the opt-in flag exposes an unauthenticated scan of arbitrary local directories to anyone who can reach the dashboard port; keep the server bound to loopback (the default) and leave the flag off on shared machines.

To start the dashboard from this source checkout:

~~~bash
npm run dev
~~~

Open http://127.0.0.1:3000.

## Documentation

| Guide | Purpose |
| --- | --- |
| [Getting started: CLI and skill](docs/GETTING_STARTED.md) | Install, commands, platform examples |
| [Architecture and storage semantics](docs/ARCHITECTURE.md) | Journal, Markdown, sync boundaries, APIs |
| [Agent Skill instructions](.agents/skills/contextforge-memory/SKILL.md) | What compatible agent hosts see |
| [CLI demo walkthrough](docs/README_DEMO.md) | Reproducible demonstration |
| [Documentation index](docs/README.md) | Full guide list, including verification notes |
| [Internal benchmark and limitations](docs/BENCHMARK_RESULTS.md) | Synthetic evaluation with methodology caveats |
| [Security reporting](SECURITY.md) | How to report vulnerabilities privately |

The benchmark is an **internal synthetic-fixture regression evaluation**, not proof of improvements over native model compaction or of downstream agent safety. Its current methodological limitations are tracked in [issue #28](https://github.com/kulharshit21/contextforge-ai/issues/28).

## Version policy

ContextForge uses `0.x` versioning. The CLI and skill surfaces are **not yet stable**: breaking changes may occur between any two releases while the major version is `0`. Tagged prereleases (for example [`v0.1.0-beta.1`](https://github.com/kulharshit21/contextforge-ai/releases/tag/v0.1.0-beta.1)) mark verified checkpoints, not stability guarantees. The requirements ContextForge holds itself to before calling anything stable are documented in the [release checklist](docs/RELEASE_CHECKLIST.md).

## Development and contributing

~~~bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
python -m unittest discover -s tests -p "test_*.py" -v
~~~

The repository's CI includes Node.js checks on Linux and Python skill tests on Linux, macOS, and Windows. See the [platform verification notes](docs/README.md) for additional manual checks and their scope.

Issues and thoughtful pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), consult the [issue tracker](https://github.com/kulharshit21/contextforge-ai/issues) — `good first issue` labels mark starter tasks — and follow the [code of conduct](CODE_OF_CONDUCT.md). AI-assisted changes are welcome when contributors take responsibility for understanding, testing, and reviewing their submissions. Report security issues privately per [SECURITY.md](SECURITY.md); do not open public issues for them.

## Project status

ContextForge is maintained by [@kulharshit21](https://github.com/kulharshit21). The CLI and skill have automated tests, and the tagged prerelease [`v0.1.0-beta.1`](https://github.com/kulharshit21/contextforge-ai/releases/tag/v0.1.0-beta.1) (2026-11-05) marks the first verified checkpoint. There is **no published npm package**, no demonstrated independent adoption benchmark, and no claim of production-grade public hosting. See the [changelog](CHANGELOG.md) and [release checklist](docs/RELEASE_CHECKLIST.md).

Licensed under [MIT](LICENSE).
