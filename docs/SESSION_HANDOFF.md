# Session handoffs: close one coding session, resume the next

ContextForge has two explicit, local-first paths for session continuity:

1. **Node CLI** (from a checked-out, installed ContextForge source): `contextforge handoff` captures verified progress and generates a compact brief. `contextforge resume` reads the existing journal in a new session.
2. **Portable Python Agent Skill** (no Node CLI required): use `save --kind ...` for important evidence, followed by `recall --task ...`. See [SKILL.md](../.agents/skills/contextforge-memory/SKILL.md).

These are **opt-in, explicit actions**. They do not automatically capture chat sessions, know what happened before you installed ContextForge, intercept a model's context truncation, or guarantee that every coding agent automatically invokes the skill.

## CLI: at the end of a development session

From the project that owns the memory:

~~~bash
contextforge handoff "Finish login flow" \
  --done "Implemented authentication middleware" \
  --failed "In-memory sessions failed because the process restarts" \
  --test "npm test passed on commit abc123" \
  --blocker "Cookie expiry needs security review" \
  --next "Write a cookie-expiry regression test" \
  --source "docs/authentication.md" \
  --budget-chars 1800
~~~

The command records each supplied statement as a separate typed journal event (and Markdown entry), then writes a short, task-relevant handoff to standard output. It refuses known secret patterns and never guesses what was accomplished. For a long transcript, record a **short verified summary**, not raw chat logs.

You can also save a new file, but only when it does not already exist:

~~~bash
contextforge handoff "Finish login flow" --next "Write expiry tests" --out next-session-handoff.md
~~~

The `--out` destination uses exclusive creation: ContextForge will not overwrite `AGENTS.md` or any other existing output. Before checkpointing, it verifies that the destination is not already occupied. If storage fails after one record is saved, inspect `contextforge audit` and retry the remaining checkpoint explicitly.

## CLI: in a fresh AI coding session

From the **same project directory**:

~~~bash
contextforge audit
contextforge resume "Finish login flow" --budget-chars 1800
~~~

Copy the bounded output into the new agent conversation, or explicitly ask your coding agent to run those commands. The `resume` command does **not** append journal events; it uses the current active journal and excludes superseded records.

A good agent should then **verify** the source paths, current files, Git history, and current test results. Memories are historical claims, not fresh instructions.

You can also use:

~~~bash
contextforge resume "Finish login flow" --out recovered-context.md
~~~

This writes a **new** file only. If you already created that filename, use another name.

## Portable Skill equivalent

If you only installed the standalone Python Skill, locate its `scripts/contextforge_memory.py` next to the installed `SKILL.md`:

~~~bash
python "$SCRIPT" --root "$PROJECT_ROOT" save --kind handoff --text "Auth middleware implemented" --source "docs/authentication.md"
python "$SCRIPT" --root "$PROJECT_ROOT" save --kind blocker --text "Cookie expiry needs security review"
python "$SCRIPT" --root "$PROJECT_ROOT" save --kind next --text "Write a cookie-expiry regression test"
python "$SCRIPT" --root "$PROJECT_ROOT" recall --task "Finish login flow" --budget-chars 1800
~~~

The Node CLI and portable Python Skill share the hash-chained journal format. Python entries don't immediately update all structured Markdown mirrors; the Node CLI can import Markdown to journal, but full bidirectional synchronization is not implemented.

## What this feature does and does not prove

- **Implemented:** explicit records for completed work, failed methods, test evidence, blockers and next actions; task-scoped, size-bounded recall; no account or model API required.
- **Not implemented:** automatic chat capture, AI verification of every record, automatic context handoff between every agent product, continuous background recording, or native model-compaction interception.
- **Trust:** do not store secrets or personally sensitive content. Retrieved notes may be outdated, incorrect or attacker-controlled. Use `--source` when possible and check the repository before acting.
- **Availability:** this command is a **source CLI feature** until its PR is merged and distributed. The published `v0.1.0-beta.1` source release does not include it, and the npm package is still private.
