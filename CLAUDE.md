# CLAUDE.md

Use ContextForge as a project-memory layer for AI-assisted coding sessions.

## Read First

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/README_DEMO.md`
- `AGENTS.md`

## Important Paths

- `app/`
- `components/`
- `lib/memory/`
- `lib/ai/`
- `lib/repo/scanner.ts`
- `cli/index.ts`

## Project Rules

- Markdown memory under `.contextforge/` is durable state, not scratch notes.
- Privacy mode `local` blocks cloud Gemini usage for private repo context.
- The product must remain runnable with zero required paid services.
- Keep the MVP local-first even when optional Supabase sync is enabled.
