# Getting started with ContextForge

ContextForge provides two ways to work with project memory: a Node.js CLI and a portable Python Agent Skill. You can use either independently or use the CLI to keep a journal and structured Markdown together.

**No npm package has been published yet.** Use the source checkout and `npm link`. Do not rely on `npx contextforge` from the public registry.

## 1. Prerequisites

- Node.js 24 (reference CI runtime) and npm for the CLI.
- Python 3.10+ for the standalone skill; no Python packages are needed.
- Git for optional commit and repository metadata.
- A project directory you control. Do not test the commands on sensitive production work until you understand their output.

## 2. Install the CLI from source

~~~bash
git clone https://github.com/kulharshit21/contextforge-ai.git
cd contextforge-ai
npm ci
npm link
contextforge --help
~~~

`npm link` exposes the source checkout's executable on your computer. To uninstall the global link later, run `npm unlink -g contextforge`. A published, verified installation method will be added when a release actually exists.

### Create a test workspace

On macOS or Linux:

~~~bash
mkdir ../contextforge-playground
cd ../contextforge-playground
contextforge init
contextforge checkpoint "Choose SQLite for the local cache" --kind decision --source docs/architecture.md
contextforge checkpoint "Add integration tests for restart recovery" --kind next
contextforge recall "cache recovery" --level handoff
contextforge audit --verbose
~~~

On Windows PowerShell:

~~~powershell
New-Item -ItemType Directory -Force ..\contextforge-playground
Set-Location ..\contextforge-playground
contextforge init
contextforge checkpoint "Choose SQLite for the local cache" --kind decision --source docs/architecture.md
contextforge checkpoint "Add integration tests for restart recovery" --kind next
contextforge recall "cache recovery" --level handoff
contextforge audit --verbose
~~~

The example source path is a **note**, not proof the example file exists. Use a real relative path or commit SHA when recording verified project decisions.

## 3. Resume a future session

From that same project directory:

~~~bash
contextforge recall "cache recovery" --level capsule
contextforge recall "cache recovery" --level evidence
contextforge scan
contextforge doctor
~~~

You can use three recall views:

| View | Default character budget | Typical use |
| --- | ---: | --- |
| `handoff` | 1,800 | Session restart, urgent blockers and next steps |
| `capsule` | 4,500 | Task-specific memory and supporting decisions |
| `evidence` | 8,000 | Detailed provenance inspection |

Use `--budget-chars 1500` to override the budget. Size is measured in **characters**, not exact model tokens. A note is not inherently true because it appears in a context capsule; review your repository and tests.

**File safety:** `contextforge export` refuses to replace existing generated files unless you explicitly pass `--force`. Recent versions of `recall --out FILE` also refuse to overwrite existing files; confirm your local checkout is current before writing to valuable paths.

## 4. Install the portable Agent Skill

If your agent supports repository-level Agent Skills discovery, copy the following folder to the repository where you work:

`.agents/skills/contextforge-memory/`

If the target is a different project and you are in the ContextForge source checkout, on macOS/Linux:

~~~bash
mkdir -p ../my-project/.agents/skills
cp -R .agents/skills/contextforge-memory ../my-project/.agents/skills/
~~~

On Windows PowerShell:

~~~powershell
New-Item -ItemType Directory -Force ..\my-project\.agents\skills
Copy-Item -Recurse -Force .agents\skills\contextforge-memory ..\my-project\.agents\skills\
~~~

Open the target project in a compatible agent and request the `contextforge-memory` skill explicitly if needed. Discovery is controlled by the particular host; ContextForge does not automatically intercept all conversations.

With a copy of the skill in the target project:

~~~bash
python .agents/skills/contextforge-memory/scripts/contextforge_memory.py --root . init
python .agents/skills/contextforge-memory/scripts/contextforge_memory.py --root . save --kind decision --text "Keep project state local" --source docs/architecture.md
python .agents/skills/contextforge-memory/scripts/contextforge_memory.py --root . recall --task "project state" --budget-chars 2500
python .agents/skills/contextforge-memory/scripts/contextforge_memory.py --root . audit
~~~

Prefer `--stdin` rather than command-line `--text` for private project notes to reduce command-history exposure. **Never store credentials, confidential transcripts, or personal data.**

## 5. Where is my data?

| Path | Purpose |
| --- | --- |
| `.contextforge/agent-memory/events.jsonl` | Append-only checkpoint journal |
| `.contextforge/DECISIONS.md`, `CURRENT_TASKS.md`, etc. | Structured Markdown written through the CLI |
| `.contextforge/repo-scan.json` | Repository metadata scan |
| `.contextforge/CAPSULES/` | Saved context capsules |

The CLI checkpoint path writes both a journal record and Markdown by default. The Python script writes the journal only. `contextforge sync` imports Markdown notes into the journal; it does not automatically rewrite Markdown from Python records. This is a current limitation, not something to rely upon as automatic two-way synchronization.

Keep local memory out of Git unless you have intentionally reviewed and approved it for publication. Add `.contextforge/` to your project's `.gitignore` as needed. Make backups before running recovery or manually modifying local memory.

## 6. Problems and diagnostics

- **`contextforge` isn't found:** Return to the source checkout and run `npm link`. Verify Node.js and npm are on PATH.
- **A file already exists:** Don't force replacement blindly. Inspect it, commit it, or back it up.
- **Hash-chain audit fails:** Preserve a copy of the journal and examine the problem before running `contextforge repair`. Repair writes backups but can discard a damaged log suffix.
- **Your agent doesn't recognize the skill:** Verify the exact `.agents/skills/contextforge-memory/SKILL.md` path and consult your agent host's skill discovery rules.
- **The dashboard is inaccessible remotely:** This is intentional: it is bound to localhost and doesn't implement multi-user authorization.

Check [architecture](ARCHITECTURE.md), [security policy](../SECURITY.md), and [issue tracker](https://github.com/kulharshit21/contextforge-ai/issues) before reporting problems.
