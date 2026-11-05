# ContextForge Classification and Drift Test Fixtures

This directory documents the expected behavior, precedence rules, and limitations of ContextForge's offline heuristic classifier and drift detector.

## Note classification precedence

ContextForge memory note classification (`inferFileKeyFromText` in `lib/memory/engine.ts`) runs purely offline using deterministic regular expressions. When notes contain mixed terminology, precedence is evaluated in the following strict order:

1. **Bugs and fixes (`BUGS_AND_FIXES`)**: Matches terms like `bug`, `error`, `fix`, `redirect loop`, `failed request`, `exception`.
   *Tradeoff*: A note describing an API bug (e.g. "Bug: /v1/checkout endpoint returns 500") is routed to `BUGS_AND_FIXES` rather than `API_CONTRACTS` because debugging context is higher priority for immediate coding agent recovery.
2. **Failed attempts (`FAILED_ATTEMPTS`)**: Matches `failed attempt`, `tried`, `did not work`, `doesn't work`, `didn't work`.
   *Tradeoff*: Prevents repeating failed solutions even if they mention architecture or libraries.
3. **Coding rules (`CODING_RULES`)**: Matches `rls`, `style rule`, `naming convention`, `do not`, `don't`, `must not`, `must`.
   *Tradeoff*: Enforces policy and negative constraints over general documentation.
4. **Decisions (`DECISIONS`)**: Matches `decision`, `decided`, `tradeoff`, `alternative`.
   *Tradeoff*: A deliberate decision involving APIs (e.g. "We decided to deprecate /v1/auth") is preserved in `DECISIONS`, preventing it from being misfiled into `API_CONTRACTS`.
5. **API contracts (`API_CONTRACTS`)**: Matches `route`, `endpoint`, `payload`, `response`, `table`, `schema`, `api`, `apis`.
6. **Environment and setup (`ENV_AND_SETUP`)**: Matches `npm`, `pnpm`, `yarn`, `bun`, `env`, `install`, `setup`, `supabase`, `ollama`, `gemini`.
7. **Current tasks (`CURRENT_TASKS`)**: Matches `task`, `next step`, `blocker`, `todo`, `currently`, `active`.
8. **Architecture (`ARCHITECTURE`)**: Matches `architecture`, `folder`, `data flow`, `auth flow`, `storage flow`, `system`.
9. **Features (`FEATURES`)**: Matches `feature`, `invoice`, `module`, `implemented`, `completed`, `planned`.
10. **Fallback (`PROJECT_STATE`)**: Default destination for general grounded facts and requirements.

## Drift detection heuristics

The drift engine (`detectMemoryDrift` in `lib/memory/drift.ts`) compares saved memory against the latest deterministic repository scan (`repo-scan.json`):

- **Framework mismatch (High severity)**: Triggers when memory references a known framework (e.g., Express, FastAPI) that differs from the detected framework (e.g., Next.js).
- **Missing npm scripts (Medium severity)**: Detects runnable commands in memory (e.g. `npm run <script>`) not declared in `package.json.scripts`.
- **Missing or renamed paths (Medium severity)**: Flags files in memory items (`related_files` or `source`) that were not discovered in the repo scan universe.
- **Undocumented environment variables (Low severity)**: Scans memory for common env prefixes (`NEXT_`, `SUPABASE_`, `GEMINI_`, `OLLAMA_`, `CONTEXTFORGE_`) and warns if missing from `.env.example`.

## Limitations

- **No semantic inference**: Heuristics rely on keyword presence. Unconventional phrasing may default to `PROJECT_STATE`. Explicit `--kind` override is always supported on `contextforge checkpoint`.
- **Offline scan boundary**: Drift checks only inspect files and scripts within the workspace root. Dynamic runtime endpoints or remote cloud resources are not audited offline.
