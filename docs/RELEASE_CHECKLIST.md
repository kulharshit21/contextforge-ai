# Release Checklist — for maintainers

This document describes checks **before** declaring an official release. Do not claim a release exists until the checks and publication have actually completed.

- [ ] Main branch CI is green for typecheck, lint, integration tests, build, and CLI smoke.
- [ ] Independently verify Windows, macOS, and Linux installation using supported Node versions.
- [ ] Ensure no generated agent instruction files unexpectedly overwrite user work.
- [ ] Confirm package licensing and dependency redistribution terms.
- [ ] Bundle the CLI as an installable artifact; do not publish the private Next.js application by accident.
- [ ] Move runtime loader dependencies such as tsx into the published dependency graph, or compile into a standalone CLI bundle.
- [ ] Audit npm package contents with npm pack --dry-run --json.
- [ ] Check npm registry name availability and repository ownership.
- [ ] Run dependency and secret scans; resolve or document findings.
- [ ] Rehearse install from a tarball in a clean directory (no repo source or devDependencies).
- [ ] Verify contextforge --help, init, scan, capsule, doctor, and export from that clean install.
- [ ] Review changelog, tagged version, and migration notes.
- [ ] Obtain maintainer approval before publishing to npm or creating GitHub Releases.

**Not yet done:** package.json remains private and npx contextforge is not an advertised installation method. Unchecking this restriction is not a substitute for the above checks.
