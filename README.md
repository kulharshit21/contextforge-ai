# ContextForge

Local-first AI project memory compiler for coding agents.

ContextForge turns messy chats, repo scans, bug notes, feature history, architecture decisions, and failed attempts into structured project memory plus task-specific context capsules for Cursor, Claude, Codex, Copilot, Gemini, and local agents.

> Git remembers what changed. ContextForge remembers why it changed.

## Why It Exists

AI-assisted projects lose context fast:

- chats grow too long
- agents forget old decisions
- the same bugs repeat
- new sessions waste tokens re-reading repo state
- each agent wants context in a slightly different format

ContextForge keeps durable project memory in structured markdown and generates small paste-ready capsules for the exact task you want to work on next.

## Demo Assets

Placeholders for first public demo:

- `docs/demo/assets/landing-placeholder.png`
- `docs/demo/assets/dashboard-placeholder.png`
- `docs/demo/assets/project-detail-placeholder.png`
- `docs/demo/assets/demo-placeholder.gif`

## Quick Start

### Web app

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

If you do not set Supabase keys, the app runs in demo mode with seeded sample data.

### CLI

```bash
npx contextforge init
npx contextforge scan
npx contextforge capsule "Add pharmacy invoice feature"
```

## What You Can Do

- compile durable multi-file project memory under `.contextforge/`
- ingest AI chat transcripts into typed memory sections
- scan the repo and save facts to `repo-scan.json`
- generate task-specific context capsules
- detect drift between memory and the actual repo
- export instructions for AGENTS, Claude, Gemini, Cursor, and Copilot
- run fully in local/demo mode with no required paid service

## CLI Commands

```bash
npx contextforge init
npx contextforge remember "Do not bypass Supabase RLS policies"
npx contextforge ingest-chat ./chat.md
npx contextforge scan
npx contextforge capsule "Add pharmacy invoice feature"
npx contextforge doctor
npx contextforge export --all
npx contextforge stats
npx contextforge ui
```

## Free-First Architecture

- Frontend/backend: Next.js App Router
- UI: Tailwind CSS, shadcn-style primitives, lucide-react, framer-motion
- Local memory: markdown files under `.contextforge/`
- Optional cloud sync: Supabase free tier
- Default cloud AI: Gemini free tier
- Local AI fallback: Ollama-compatible HTTP endpoint
- Hosting target: Vercel Hobby

No credit-card-only dependency is required for the MVP demo path.

## Privacy Note

- `CONTEXTFORGE_PRIVACY_MODE=local` is the safe default.
- In local privacy mode, ContextForge should use Ollama or mock behavior instead of sending private repo content to Gemini.
- Supabase service-role credentials are server-only and must never be exposed to the browser.
- Runtime-generated repo scans and local workspaces may include machine-specific paths, so they are intentionally ignored from Git.

## Example Workflow

1. Run `npx contextforge init` inside a repo.
2. Save durable facts with `remember` or `ingest-chat`.
3. Refresh repo facts with `npx contextforge scan`.
4. Generate a capsule for the next coding task.
5. Run `doctor` when memory may be stale.
6. Export agent-specific instructions when handing work to a different tool.

## Hackathon / Demo Script

See [docs/README_DEMO.md](./docs/README_DEMO.md) for a short live-demo flow.

Recommended live path:

1. Open the landing page and dashboard in demo mode.
2. Show `CareGrid Demo`.
3. Generate a capsule for `Add pharmacy invoice feature`.
4. Run a drift check.
5. Show `npx contextforge scan` and `npx contextforge capsule "task"` in the CLI.
6. Export agent files.

## Sample Demo Data

Commit-safe sample outputs live in:

- [docs/demo/sample-capsule.md](./docs/demo/sample-capsule.md)
- [docs/demo/sample-project-memory.md](./docs/demo/sample-project-memory.md)

Runtime-generated `.contextforge/` and `workspaces/` folders are local artifacts and are not committed.

## Environment Variables

Optional environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `CONTEXTFORGE_AI_PROVIDER=gemini|ollama|mock`
- `CONTEXTFORGE_PRIVACY_MODE=local|cloud`

See [.env.example](./.env.example).

## Roadmap

- real Supabase auth and cloud sync UI
- richer memory patch preview and conflict resolution
- GitHub PR / review ingestion
- MCP server mode for direct memory access
- better semantic retrieval across large repos
- richer demo screenshots and video assets

## Novelty

Existing tools either store static instructions, save raw AI chat history, or provide tool-specific memory. ContextForge introduces a local-first memory compiler that converts messy development history into structured, versioned, multi-file project memory and generates task-specific context capsules for different AI coding agents. It also detects memory drift by comparing saved context against the actual repository, preventing agents from following outdated assumptions.

## License

MIT
