# ContextForge Dependency Security Audit & Triage

*Date: 2026-11-05*  
*Related GitHub Issues: #2, #32*

---

## 1. Executive Summary

A full dependency audit was performed using `npm audit` and `npm audit --omit=dev` on Node 24.
Prior to this remediation, `npm ci` reported **24 vulnerabilities** (2 low, 9 moderate, 10 high, 3 critical).

Targeted dependency upgrades and conservative package overrides remediated direct and high-severity advisories:
- Upgraded `simple-git` to `^4.0.2` (resolving critical command-execution and argv-parser vulnerabilities).
- Upgraded `zod` to `^4.6.7` (resolving high-severity schema collection memory exhaustion).
- Upgraded `next` to `^16.4.5` and `eslint-config-next` to `^16.4.5` (resolving critical Server Components DoS [GHSA-8h8q-6873-q5fj](https://github.com/vercel/next.js/security/advisories/GHSA-8h8q-6873-q5fj), cache poisoning, SSRF, and associated image optimization advisories).
- Added package overrides for `postcss` (`^8.5.32`), `source-map-js` (`^1.2.2`), `nanoid` (`^3.3.20`), and `js-yaml` (`^3.15.2`).

As a result:
- **`npm audit --omit=dev`**: Reduced to **4 total vulnerabilities** (0 critical, 2 high, 1 moderate, 1 low), all in unused or strictly opt-in cloud paths.
- **Production critical vulnerabilities**: **0**.

---

## 2. Remediated Packages

| Package | Previous Version | Patched Version | Severity | Advisory / CVE | Resolution Summary |
|---|---|---|---|---|---|
| `next` | `16.2.4` | `^16.4.5` | Critical | GHSA-8h8q-6873-q5fj | Upgraded Next.js to 16.4.5, resolving Server Components DoS, cache poisoning, SSRF, and upstream `sharp` vulnerabilities. Tested with Next.js Turbopack production build. |
| `simple-git` | `3.36.0` | `^4.0.2` | Critical | GHSA-v5rq-49vh-5v5c | Resolves `@simple-git/argv-parser` `VISUAL` editor omission vulnerability and long-option command execution bypasses. Refactored `lib/memory/engine.ts` and `lib/repo/scanner.ts` to use named `simpleGit` export and strict typing. |
| `zod` | `4.4.1` | `^4.6.7` | High | GHSA-mrhx-c7xc-m3w5 | Resolves collection memory exhaustion vulnerability during schema parsing. |
| `js-yaml` | `3.14.2` | `^3.15.2` (override) | High | GHSA-h67p-54hq-rp68, GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj, GHSA-2883-xcg3-v3hh | Resolves quadratic CPU consumption in merge-key chains and `!!omap` resolution in `gray-matter`. |
| `postcss` | `8.5.13` | `^8.5.32` (override) | High | GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 | Resolves source map path traversal and arbitrary `.map` file disclosure. |
| `source-map-js` | `1.2.1` | `^1.2.2` (override) | High | GHSA-68fv-2mgg-jv7q | Resolves indexed source-map section offset event loop DoS. |
| `nanoid` | `3.3.12` | `^3.3.20` (override) | High | GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8 | Resolves infinite loop denial-of-service in custom/negative-sized generators. |

---

## 3. Triage of Remaining Transitive Advisories & Compensating Controls

The 4 remaining advisories in `npm audit --omit=dev` are transitive dependencies in opt-in cloud integrations or build tools:

### 3.1 ProtobufJS (`protobufjs@7.5.6` via `@google/genai@1.51.0`)
- **Reported Advisories:** Denial of service via unbounded Any expansion / recursion (`GHSA-jggg-4jg4-v7c6`).
- **Runtime Reachability:** **Controlled / Opt-in**.
- **Compensating Controls:**
  - ContextForge operates in local/offline mode by default (`CONTEXTFORGE_PRIVACY_MODE=local`).
  - When cloud AI is optionally configured, payloads are standard structured JSON payloads, never untrusted binary protobuf descriptor inputs.

### 3.2 WS (`ws@8.18.0` via `@supabase/supabase-js` -> `@supabase/realtime-js`)
- **Reported Advisories:** Memory exhaustion DoS from tiny fragments and data chunks (`GHSA-96hv-2xvq-fx4p`).
- **Runtime Reachability:** **Controlled / Opt-in**.
- **Compensating Controls:**
  - Supabase client is only activated when cloud storage environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are explicitly provided.
  - In default local operation, no WebSocket connections are established.

### 3.3 ESBuild (`esbuild@0.27.7` via `tsx@4.21.0`)
- **Reported Advisories:** Arbitrary file read in esbuild dev server on Windows (`GHSA-g7r4-m6w7-qqqr`).
- **Runtime Reachability:** **Unreachable**.
- **Compensating Controls:**
  - ContextForge uses `tsx` solely to execute TypeScript CLI commands and test harnesses, never starting the esbuild HTTP development server.

### 3.4 Baseline-Browser-Mapping (`baseline-browser-mapping@2.10.0` via Next.js browserslist)
- **Reported Advisories:** Process termination on invalid input causes denial of service (`GHSA-w5vr-8v7q-w6rv`).
- **Runtime Reachability:** **Build-time only**.
- **Compensating Controls:**
  - Used strictly during static compilation for CSS target mapping; not executed at runtime.

---

## 4. Hosted vs Local Deployment Boundary

- **Local operation:** Development and start scripts bind to `127.0.0.1` loopback by default (`next dev --hostname 127.0.0.1`).
- **Hosted demo (Vercel):** The repository provides a public demonstration deployment. In this mode (`VERCEL=1`), all local filesystem operations (`save`, `write`, `export`) are strictly disabled, and the application serves read-only seeded demo data.
- **Residual risk:** While Next.js 16.4.5 patches known framework DoS and cache poisoning advisories, public multi-user hosting of filesystem-backed APIs remains unsupported without authentication and authorization.

---

## 5. Verification & Testing Evidence

All checks verified on Node v24.18.0 and Python 3.12:
- **Typecheck:** `npm run typecheck` — 0 errors.
- **Linting:** `npm run lint` — 0 errors, 0 warnings.
- **Node Integration Tests:** `npm test` — 15/15 test assertions passed (including clean tarball installation in clean directory).
- **Python Memory Engine Tests:** `python -m unittest discover -s tests -p "test_*.py" -v` — 16/16 tests passed.
- **Next.js Production Build:** `npm run build` — Next.js 16.4.5 Turbopack compiled successfully in 5.4s; 11/11 static pages generated.
