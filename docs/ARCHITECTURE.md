# ContextForge Architecture

## Overview

ContextForge has three main layers:

1. `app/`
   Next.js App Router dashboard and API routes.
2. `lib/`
   Shared business logic: memory engine, repo scanner, AI providers, exports, drift detection, Supabase helpers, and server project orchestration.
3. `cli/`
   Commander.js CLI that reuses the same memory engine and repo scanner as the web app.

## Durable Memory Model

- Local markdown under `.contextforge/` is the primary source of truth.
- Each memory file stores typed items with metadata.
- The human-readable markdown body is regenerated from structured frontmatter items.

## AI Layer

- `MockProvider` keeps the app working with zero configuration.
- `GeminiProvider` is the default cloud provider when privacy mode permits.
- `OllamaProvider` is the local model path for private workspaces.
- All model outputs are validated with Zod before use.

## Data Access

- Demo mode uses seeded healthcare project data plus an editable local starter workspace.
- Optional Supabase migrations are included for future cloud sync.
- Server routes under `app/api/` mediate sensitive operations like AI calls and file persistence.

## Repo Scan + Drift

- Repo scanning uses `fast-glob` + `simple-git`.
- Drift detection compares memory claims against scanned facts such as framework, scripts, file references, and env examples.

## Exports

- Export generation produces concise instructions for different agent ecosystems.
- MVP includes an MCP-style manifest JSON but not a full MCP server yet.
