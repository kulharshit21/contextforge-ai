# ContextForge Demo Walkthrough

This walkthrough uses real local CLI operations and the seeded dashboard. It does **not** require a paid API.

## Prepare

~~~bash
git clone https://github.com/kulharshit21/contextforge-ai.git
cd contextforge-ai
npm ci
npm link
npm run dev
~~~

Open http://127.0.0.1:3000/dashboard. The starter workspace is editable when running locally; the hosted Vercel demo is read-only. Do not host the local filesystem API publicly.

## Dashboard path

1. Open the seeded demo project (CareGrid Demo).
2. Inspect the memory and capsule tabs.
3. Generate a task capsule, then inspect its source context.
4. Run the drift check and review warnings.
5. Open the exports tab and compare agent-specific formats.
6. Open the local starter project and edit a memory file (local run only).

Seeded demo figures are **illustrative**, not measured benchmarks.

## Reproducible CLI walkthrough

Start a new, disposable repository/directory. Run:

~~~bash
contextforge init
contextforge remember "Decision: use local Markdown as the project source of truth."
contextforge scan
contextforge capsule "Add a validation test"
contextforge doctor
contextforge stats
contextforge export --all
~~~

Look at .contextforge/PROJECT_STATE.md, .contextforge/DECISIONS.md,
.contextforge/repo-scan.json, and the saved capsule under .contextforge/CAPSULES/.

The export command writes AGENTS.md and other agent files into the current directory; use a throwaway directory or commit existing files before running it.

## Demo assets

Real screenshots and terminal recordings are welcome through contributions. We intentionally do not claim placeholder images or seeded dashboard metrics as proof of production usage.

For checks, run npm run typecheck, npm run lint, npm test, and npm run build.
