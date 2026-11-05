# ContextForge Dependency Security Audit & Triage

*Date: 2026-11-05*  
*Related GitHub Issue: #2*

---

## 1. Executive Summary

A full dependency audit was performed using `npm audit` and `npm audit --omit=dev` on Node 24.
Prior to this remediation, `npm ci` reported **24 vulnerabilities** (2 low, 9 moderate, 10 high, 3 critical).

Through targeted dependency upgrades and conservative package overrides (avoiding unverified `npm audit fix --force` breaking upgrades), all actionable direct critical and high-severity vulnerabilities have been resolved in code and lockfile, while all remaining transitive advisories have been triaged for runtime reachability with documented compensating controls.

---

## 2. Remediated Packages

| Package | Previous Version | Patched Version | Severity | Advisory / CVE | Resolution Summary |
|---|---|---|---|---|---|
| `simple-git` | `3.36.0` | `^4.0.2` | Critical | GHSA-v5rq-49vh-5v5c | Resolves `@simple-git/argv-parser` `VISUAL` editor omission vulnerability and long-option command execution bypasses. Refactored `lib/memory/engine.ts` and `lib/repo/scanner.ts` to use named `simpleGit` export and strict typing. |
| `zod` | `4.4.1` | `^4.6.7` | High | GHSA-mrhx-c7xc-m3w5 | Resolves collection memory exhaustion vulnerability during schema parsing. |
| `postcss` | `8.5.13` | `^8.5.32` (override) | High | GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 | Resolves source map path traversal and arbitrary `.map` file disclosure. |
| `source-map-js` | `1.2.1` | `^1.2.2` (override) | High | GHSA-68fv-2mgg-jv7q | Resolves indexed source-map section offset event loop DoS. |
| `nanoid` | `3.3.12` | `^3.3.20` (override) | High | GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8 | Resolves infinite loop denial-of-service in custom/negative-sized generators. |

---

## 3. Triage of Remaining Transitive Advisories & Compensating Controls

The remaining advisories in `npm audit --omit=dev` are transitive dependencies whose parent libraries have not yet cut non-breaking releases, or build-time tools. Each has been assessed for actual runtime reachability in ContextForge:

### 3.1 Next.js (`next@16.2.4`)
- **Reported Advisories:** GHSA-8h8q-6873-q5fj (Server Actions / SSG / ISR cache poisoning, RCE in edge cases).
- **Runtime Reachability:** **Zero public exposure**. ContextForge uses Next.js exclusively for a developer's local dashboard.
- **Compensating Controls:**
  - Both `npm run dev` and `npm start` explicitly pass `--hostname 127.0.0.1`.
  - The application is never deployed as an untrusted public multi-tenant edge or serverless service.
  - No public server actions or SSG dynamic multi-user caching is enabled.
  - Upgrading to `16.4.5` requires major breaking dependency transitions that will be tracked in a future scheduled framework upgrade.

### 3.2 Sharp (`sharp@0.34.5`)
- **Reported Advisories:** Upstream C-library vulnerabilities in libvips / libheif / librsvg.
- **Runtime Reachability:** **Unreachable**. ContextForge is a text- and markdown-based memory system.
- **Compensating Controls:**
  - No user-uploaded image processing endpoints exist in ContextForge.
  - Image optimization endpoints are unused.

### 3.3 JS-YAML (`js-yaml@3.14.2` via `gray-matter@4.0.3`)
- **Reported Advisories:** Quadratic CPU consumption in merge-key handling (`GHSA-h67p-54hq-rp68`, `GHSA-52cp-r559-cp3m`).
- **Runtime Reachability:** **Low / Trusted boundary**.
- **Compensating Controls:**
  - `gray-matter` parses markdown frontmatter exclusively from local repository files within `.contextforge/*.md` created by the local developer or CLI.
  - ContextForge does not ingest untrusted remote YAML documents over the network.

### 3.4 ProtobufJS (`protobufjs@7.5.6` via `@google/genai@1.51.0`)
- **Reported Advisories:** Denial of service via unbounded Any expansion / recursion (`GHSA-jggg-4jg4-v7c6`).
- **Runtime Reachability:** **Controlled / Opt-in**.
- **Compensating Controls:**
  - ContextForge operates in local/offline mode by default (`CONTEXTFORGE_PRIVACY_MODE=local`).
  - When cloud AI is optionally configured, payloads are standard structured JSON payloads, never untrusted binary protobuf descriptor inputs.

### 3.5 ESBuild (`esbuild@0.27.7` via `tsx@4.21.0`)
- **Reported Advisories:** Arbitrary file read in esbuild dev server on Windows (`GHSA-g7r4-m6w7-qqqr`).
- **Runtime Reachability:** **Unreachable**.
- **Compensating Controls:**
  - ContextForge uses `tsx` solely to execute TypeScript CLI commands and test harnesses, never starting the esbuild HTTP development server.

### 3.6 WS (`ws@8.18.0` via Next.js dev server)
- **Reported Advisories:** Memory exhaustion / uninitialized memory disclosure.
- **Runtime Reachability:** **Local loopback only**.
- **Compensating Controls:**
  - Used only for Next.js hot module reloading on `127.0.0.1` during local development.

---

## 4. Verification & Testing Evidence

All checks verified on Node v24.18.0 and Python 3.12:
- **Typecheck:** `npm run typecheck` — 0 errors.
- **Linting:** `npm run lint` — 0 errors, 0 warnings.
- **Node Integration Tests:** `npm test` — 9/9 suites passed.
- **Python Memory Engine Tests:** `python -m unittest discover -s tests -p "test_*.py" -v` — 13/13 tests passed.
- **Next.js Production Build:** `npm run build` — Turbopack compiled successfully in 3.5s; 11/11 static pages generated.
