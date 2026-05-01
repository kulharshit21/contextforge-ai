# GitHub Copilot Instructions

ContextForge is a local-first AI project memory compiler built with Next.js and TypeScript.

## Before Editing

- Read `README.md` and `docs/ARCHITECTURE.md`.
- Check `AGENTS.md` for repo-specific working rules.
- Prefer the shared logic in `lib/` over duplicating behavior in route files or components.

## Local Validation

- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Product Constraints

- No required paid APIs
- Demo mode must work without Supabase keys
- Local markdown memory is the primary source of truth
- Privacy mode `local` must avoid sending private repo context to Gemini
