# ContextForge

**Local project memory for AI coding agents.** Record the decisions, fixes, constraints, and unfinished work that matter, then bring the right context into your next coding session.

[![CI](https://github.com/kulharshit21/contextforge-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/kulharshit21/contextforge-ai/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Git tells you what changed. ContextForge helps you remember why.

ContextForge is an **early-stage, MIT-licensed project** with two entry points: a Node.js CLI for maintaining project context and a portable Python-based Agent Skill for session handoffs. It works offline by default. The source is available here; **there is no published npm release yet**.

## Why ContextForge?

Coding sessions often lose the reasoning behind a change: why a library was chosen, which fix failed, what was verified, or which blocker remains. ContextForge keeps those notes in your project workspace so they can be recovered after a new session or a long conversation.

- **Checkpoint:** Save decisions, bugs, tests, blockers, and next steps, optionally linked to evidence.
- **Recall:** Select relevant entries with an explicit character budget (`handoff`, `capsule`, or `evidence`).
- **Audit:** Verify an append-only journal and inspect project memory.
- **Stay local:** No model API or account is needed for the default workflow.

ContextForge is **not** an automatic replacement for model-native context compaction, and retrieved notes still need verification.

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

`init` creates a local `.contextforge/` workspace. Checkpointing through the CLI writes to the journal and structured Markdown. `recall` produces a task-specific view; it does not rewrite previous decisions. Generated local memory is ignored by Git in this repository; set an equivalent ignore rule in any other project where you install the tool.

**Important:** `npm link` uses your checked-out source. The package is currently private and **not** published; do not assume `npx contextforge` installs this project.

For Windows PowerShell, platform-specific examples, additional commands, and output-file safety, see the [getting-started guide](docs/GETTING_STARTED.md).

## Use as an Agent Skill

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
| Local dashboard | Explore seeded examples and an editable local workspace |

The dashboard is a **localhost development tool**, not an authenticated multi-user service. Vercel hosts a read-only seeded demo; do not expose local filesystem-backed endpoints to the public internet.

To start the dashboard from this source checkout:

~~~bash
npm run dev
~~~

Open http://127.0.0.1:3000.

## Documentation

- [Getting started: CLI and skill](docs/GETTING_STARTED.md)
- [Architecture and storage semantics](docs/ARCHITECTURE.md)
- [Agent Skill instructions](.agents/skills/contextforge-memory/SKILL.md)
- [CLI demo walkthrough](docs/README_DEMO.md)
- [Documentation index](docs/README.md)
- [Internal synthetic benchmark and limitations](docs/BENCHMARK_RESULTS.md)
- [Security reporting](SECURITY.md)

The benchmark is an **internal synthetic-fixture regression evaluation**, not proof of improvements over native model compaction or of downstream agent safety. Its current methodological limitations are tracked in [issue #28](https://github.com/kulharshit21/contextforge-ai/issues/28).

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

Issues and thoughtful pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), consult the [issue tracker](https://github.com/kulharshit21/contextforge-ai/issues), and follow the [code of conduct](CODE_OF_CONDUCT.md). AI-assisted changes are welcome when contributors take responsibility for understanding, testing, and reviewing their submissions.

## Project status

ContextForge is maintained by [@kulharshit21](https://github.com/kulharshit21). Its CLI and skill have automated tests, but the project has **no published package or tagged release**, no demonstrated independent adoption benchmark, and no claim of production-grade public hosting. See the [changelog](CHANGELOG.md) and [release checklist](docs/RELEASE_CHECKLIST.md).

Licensed under [MIT](LICENSE).
