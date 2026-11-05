# Agent Skill installation validation

**Status: experimental install route, verification plan.** Commands are based on the open-source [skills CLI documentation](https://github.com/vercel-labs/skills/blob/main/docs/commands.md), not on completed end-to-end validation of this repository in every host. Do not label any host supported until tested.

## Why a Skill instead of localhost?

The portable `contextforge-memory` skill is instructions plus a standard-library Python companion. It writes/reads a developer-owned `.contextforge/agent-memory/events.jsonl` in the selected project. A Next.js dashboard is **not required**. The Node CLI remains useful for richer scans, Markdown synchronization and exports but is not a requirement for the portable skill.

## Candidate single-command installation

From a disposable target project, with Node.js 22.20+ (per `skills` CLI) and Python 3.10+:

~~~bash
npx skills add kulharshit21/contextforge-ai --list
npx skills add kulharshit21/contextforge-ai --skill contextforge-memory -a codex
~~~

For other supported agents, use their actual identifier from the installed `skills` CLI's supported-agent list. For example, try `-a antigravity` or `-a claude-code`; **do not publish compatibility claims until tested**.

The installer above is not `npx contextforge`; there is no published ContextForge npm release as of the creation of this document. Avoid unreviewed `curl | bash` installation scripts.

## End-to-end verification protocol

In a clean temporary project:
1. Record OS and version, Node/npm/Python versions, installed agent and agent version, installer version, install destination and console output.
2. Run `npx skills add kulharshit21/contextforge-ai --list`. Confirm `contextforge-memory` is discovered.
3. Install with `--skill contextforge-memory -a <supported-agent>`; inspect files and ensure `SKILL.md`, `scripts/contextforge_memory.py`, and `references/design.md` are present.
4. Independently ask the target agent to list or explicitly use the skill. Recording file presence is **not** proof of discovery or invocation.
5. Perform `init`, save a verified decision and next action, audit, and bounded task-based recall. Leave the coding session. Start a new session and ask the agent to recover the specific saved decision while comparing it to current source.
6. Modify a record using the documented supersedes path and verify obsolete decisions do not appear as current.
7. Ensure sensitive content is not stored/sent inadvertently, unknown project files are not overwritten, symlinks/path traversal are rejected, and reinstall/uninstall are safe.
8. Test offline execution of the Python companion with no model key or network; check journal integrity and crash/repair backup path.
9. Uninstall and verify unrelated agent, project and memory files remain untouched; explicitly document any manual cleanup.
10. Repeat with Windows PowerShell, macOS and Linux and each claimed agent host. Note skipped platforms honestly.

Also run the repository checks on the implementation commit:

~~~bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
python -m unittest discover -s tests -p "test_*.py" -v
npm pack --dry-run
~~~

A green CI build does not replace observing agent discovery and real user workflows. Record every failed case with the exact command and reproduction; do not claim general compatibility based on a directory check.

## Publication gate

Do not put `npx contextforge` on the front page until the actual npm package has been published and clean-installed by an external consumer. Consider a reviewed GitHub prerelease first, with clearly stated limitations, tagged source, release notes, and verifiable artifacts. Real release creation, npm publication, and deployment require maintainer review.
