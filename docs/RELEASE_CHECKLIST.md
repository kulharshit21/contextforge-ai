# Release Checklist — for maintainers

This document describes checks **before** declaring an official release. Do not claim a release exists until the checks and publication have actually completed.

- [x] Main branch CI is green for typecheck, lint, integration tests, build, and CLI smoke.
- [x] Independently verify Windows, macOS, and Linux installation using supported Node versions.
- [x] Ensure no generated agent instruction files unexpectedly overwrite user work (`export` overwrite guard).
- [x] Confirm package licensing (MIT) and dependency redistribution terms.
- [x] Resolve current high-severity Next.js advisory by upgrading to Next.js 16.4.5 and patched package-lock.json (issue #32).
- [x] Filter the CLI as an installable artifact; do not publish the private Next.js application by accident (`"files"` whitelist in `package.json` reducing tarball from 143 files to 51 files).
- [x] Standardize on relative module imports across `cli/` and `lib/` so installed packages inside `node_modules` do not require tsconfig path interception.
- [x] Move runtime loader dependencies (`tsx`) into production `dependencies`.
- [x] Audit npm package contents with `npm pack --dry-run`.
- [x] Rehearse install from a tarball in a clean directory with only production dependencies (`tests/tarball_install.test.cjs`).
- [x] Verify `contextforge --help`, `init`, `checkpoint`, `remember`, `recall`, `handoff`, `resume`, `ingest-chat`, `sync`, `scan`, `doctor`, `capsule`, `export`, and `skill` from that clean install.
- [x] Add automated publish workflow (`.github/workflows/publish.yml`) with manual `workflow_dispatch` trigger, dry-run by default, and `release-approval` environment protection.
- [ ] Check npm registry name availability and repository ownership (maintainer action).
- [ ] Review changelog, tagged version, and migration notes.
- [ ] Obtain maintainer approval before publishing to npm or creating GitHub Releases.

**Not yet done:** `package.json` remains private until the maintainer is ready for the first public release, and `npx contextforge` is not an advertised installation method in the README. Unchecking this restriction is not a substitute for the above checks.
