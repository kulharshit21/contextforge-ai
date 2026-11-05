# ContextForge

**Local-first project memory for AI coding agents.** Keep decisions, known bugs, architecture, and setup notes in versioned Markdown, then create task-specific context capsules for Codex, Cursor, Claude, Copilot, Gemini, and other assistants.

[![CI](https://github.com/kulharshit21/contextforge-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/kulharshit21/contextforge-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Git records *what* changed. ContextForge helps preserve *why*.

**Project status:** early-stage open-source MVP. The repository contains a local CLI, dashboard, mock/offline functionality, and CI checks. It is **not yet published to npm**. Some features described in the roadmap are proposals, not shipped features.

## Agent skill: local memory checkpoints and context recovery

**New experimental capability:** a portable, open-format agent skill at
[.agents/skills/contextforge-memory/SKILL.md](.agents/skills/contextforge-memory/SKILL.md).

It works as an optional, offline companion to the existing CLI. An AI coding agent can use this skill to:

- record compact **decisions, test outcomes, bugs, blockers, and next actions** with evidence references;
- recover the most relevant records for a new task within an explicit context budget;
- preserve corrections without silently changing earlier history;
- verify the local append-only journal for accidental corruption.

It does **not** intercept or replace built-in AI compaction, autonomously monitor all chats, or claim better benchmark performance than native model memory. Its retrieval is deterministic and keyword-based; agent-written notes still need verification.

### Use in a repository (Codex or compatible Agent Skills host)

1. Clone ContextForge, then copy its .agents/skills/contextforge-memory folder into **your target repository's** .agents/skills folder. Alternatively, copy it into your user's ~/.agents/skills folder. Consult the agent's skill discovery documentation.
2. Open the target repository with a compatible agent, and request the **contextforge-memory** skill explicitly if the agent does not select it automatically.
3. The skill uses Python 3.10+ with no third-party Python packages or external API calls.

~~~bash
python .agents/skills/contextforge-memory/scripts/contextforge_memory.py --root . init
python .agents/skills/contextforge-memory/scripts/contextforge_memory.py --root . save --kind decision --text "Use local Markdown as the source of truth" --source "docs/ARCHITECTURE.md"
python .agents/skills/contextforge-memory/scripts/contextforge_memory.py --root . save --kind next --text "Add a regression test for Windows CLI"
python .agents/skills/contextforge-memory/scripts/contextforge_memory.py --root . recall --task "Windows CLI testing" --budget-chars 2500
python .agents/skills/contextforge-memory/scripts/contextforge_memory.py --root . audit
~~~

Run those paths from the target repository when it contains the copied skill. Use a suitable absolute skill script path if installed at user scope. For private notes, prefer piping reviewed text to the save command using --stdin to avoid command-line history. **Never send secrets or confidential data to the memory log.** Local notes are ignored under .contextforge/ by default.

Read [design and limitations](.agents/skills/contextforge-memory/references/design.md). The existing Node/TypeScript CLI and web dashboard continue to work independently.

## What works today

- Initialize ten structured Markdown memory files inside any working directory.
- Preserve human-entered notes and extract candidate memories from a text conversation.
- Scan project structure and Git facts, excluding common secret and binary patterns.
- Generate a task-focused capsule and check saved context for drift.
- Export instructions for AGENTS.md, CLAUDE.md, GEMINI.md, Cursor, and Copilot.
- Explore an optional local Next.js dashboard with seeded demo data.
- Use the deterministic **mock mode** without an API key or credit card.

A scan is a structured metadata snapshot, **not** a full semantic code audit. Mock-mode extraction uses heuristics; review generated memories before trusting them. The exported MCP manifest is not an implemented MCP server.

## Quick start (CLI)

**Requirements:** Node.js 24 (CI target), npm, and Git for full repository metadata. Linux, macOS, and Windows are intended targets.

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
contextforge remember "Decision: store project configuration in version control, never API secrets."
contextforge scan
contextforge capsule "Add robust error handling"
contextforge doctor
contextforge export --all
contextforge stats
~~~

On Windows, replace the example directory with the path to your target project in PowerShell. The command runs in the directory from which you invoke it and creates local files under that project's .contextforge/ folder. Export refuses to overwrite existing instruction files by default. **Review and back up files before passing --force**.

**Why not npx?** This package is currently marked private and is not published. Do not use the unverified command npx contextforge from the public npm registry. Until an audited package release is published, use npm link or run node /path/to/contextforge-ai/bin/contextforge.js from your target project.

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
| contextforge init | Initialize structured local memory |
| contextforge remember "note" | Store a note in an inferred section |
| contextforge ingest-chat ./notes.txt | Extract memory from local text |
| contextforge scan | Refresh repository metadata |
| contextforge capsule "task" | Save a task-specific context capsule |
| contextforge doctor | Report likely inconsistencies or drift |
| contextforge export --all | Generate agent instructions without overwriting existing files; --force allows intentional replacement |
| contextforge stats | Inspect local workspace summary |
| contextforge ui | Show dashboard startup steps |

## Design and privacy

- The source of truth is local Markdown under .contextforge/.
- The default provider is mock; no remote LLM is required.
- CONTEXTFORGE_PRIVACY_MODE=local blocks Gemini through the provider resolver.
- To intentionally use a cloud model, review data handling and set CONTEXTFORGE_PRIVACY_MODE=cloud plus provider credentials. **Do not upload private source or chats without permission.**
- Repo scans may include paths, Git author names, and commit messages. Inspect them before sharing.
- Files in .contextforge/, workspaces/, and local environment files are ignored by Git by default.

See [.env.example](.env.example), [architecture](docs/ARCHITECTURE.md), [demo walkthrough](docs/README_DEMO.md), and [security policy](SECURITY.md).

## Quality checks

~~~bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
~~~

CI runs these checks plus a CLI smoke test. A green status applies only to the current commit; see GitHub Actions for evidence. Test coverage and external-user validation will grow over time.

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
