# ContextForge Agent Guide

ContextForge is a local-first AI project memory compiler for coding agents.

## Core Idea

- Git remembers what changed.
- ContextForge remembers why it changed.
- Durable memory lives in structured markdown files under `.contextforge/`.

## Local Commands

- `npm install`
- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Architecture

- `app/`: Next.js App Router pages and API routes
- `components/`: dashboard, layout, memory, capsule, export, and UI primitives
- `lib/`: memory engine, repo scanner, AI providers, prompts, demo data, and server orchestration
- `cli/`: Commander-based local CLI reusing the same memory engine
- `supabase/migrations/`: optional cloud schema and RLS policies

## Working Rules

- Keep local markdown memory as the source of truth.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Do not send private repo content to Gemini when privacy mode is `local`.
- Respect Supabase RLS assumptions; do not bypass them casually.
- Prefer small, durable memory updates over large free-form dumps.

## Demo Notes

- The dashboard must work without Supabase keys.
- Demo mode uses seeded healthcare project data from `lib/demo/data.ts`.
- Runtime-generated `.contextforge/` and `workspaces/` data are local artifacts and should not be committed.
