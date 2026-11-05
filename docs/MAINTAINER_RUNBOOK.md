# Maintainer Runbook

For @kulharshit21 and future maintainers. This is a repeatable workflow, not a claim of community adoption.

## Weekly triage

1. Review reproducible bug reports and requests; respond with next actions.
2. Reproduce issues on supported systems. Protect reporters' private data.
3. Mark a suitable first issue only after confirming that the steps are clear.
4. Review PRs for tests, scope, offline behavior, data handling, and documentation.
5. Track unaddressed failing CI checks and dependency updates.
6. Record meaningful changes in CHANGELOG.md.

## PR verification

- Review code and tests, not only a green badge.
- Check the pull request does not add credentials or expose local paths.
- Run typecheck, lint, tests, and build before merging.
- For filesystem/export changes, verify that existing user files are not overwritten.
- Explain merges/rejections; favor small reversible changes.

## Branch ruleset and protection

The repository enforces branch protection on `refs/heads/main` via GitHub Rulesets:
- **Deletion**: blocked.
- **Non-fast-forward (force push)**: blocked.
- **Pull request**: required before merging. For solo maintainer operation, approval count is set to 0 with conversation resolution required, preventing owner lockout while enforcing CI and PR traceability.
- **Status checks**: strict required status checks:
  - `verify`
  - `Agent memory skill (ubuntu-latest)`
  - `Agent memory skill (windows-latest)`
  - `Agent memory skill (macos-latest)`

## Release readiness

Follow docs/RELEASE_CHECKLIST.md. Do not tag, announce npm availability, or promise support until an actual verified release exists.

## Early adoption evidence

Track genuine feedback, reproducible issues, external contributions, and installation confirmations without inflating star counts or creating artificial usage. Collect voluntary anonymized reports only with consent. Keep truthful evidence for future program or grant applications.

## Known gaps

- Package is not yet published to npm (`package.json` remains `"private": true` until maintainer release sign-off).
- Hosted data is seeded demonstration, not customer adoption.
- Public dashboard auth and secure multi-tenant hosting are out of scope.
- Cloud sync remains opt-in and local-first by default.
