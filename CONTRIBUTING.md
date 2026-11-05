# Contributing to ContextForge

Thank you for helping make local-first developer tools better. We welcome bug reports, reproduction fixtures, documentation updates, tests, and carefully scoped features.

## Getting started

1. Read the [README](README.md), [architecture](docs/ARCHITECTURE.md), and [security policy](SECURITY.md).
2. Search existing [issues](https://github.com/kulharshit21/contextforge-ai/issues) and PRs before starting.
3. For a substantial feature, open an issue describing the problem and proposed approach before coding.
4. Fork the repository (or create a topic branch with write access), then run:

~~~bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
~~~

Node.js 24 is the reference CI runtime. Avoid changing the lockfile unless dependencies change.

## Changes and pull requests

- Make one logical change per PR. Link the corresponding issue if it exists.
- Include why the change matters, reproduction steps, and how it was tested.
- Add or update tests for fixes that alter behavior.
- Prefer local/offline functionality; external APIs must be opt-in.
- Never commit credentials, real private transcripts, or patient/customer data.
- Preserve public APIs when possible; explain breaking changes.
- Do not claim benchmark performance or supported operating systems without reproducing results.
- Before changing export behavior, verify that users cannot accidentally lose existing files.

Use the PR template, allow the CI workflow to complete, and address feedback in the review thread. A merged PR is not an automatic promise of maintainership.

## Good first contributions

- Verify installation and CLI behavior on Windows/macOS, with exact OS/Node versions.
- Improve descriptions for mock-mode versus AI-backed behavior.
- Add deterministic test fixtures for drift detection and chat ingestion.
- Find and fix misleading README/command output.
- Improve accessibility and keyboard interactions in the dashboard.

## Responsible disclosure

Security issues involving secrets, local file access, or unintended remote data exposure should be reported privately under [SECURITY.md](SECURITY.md), not as public issues.

## Project direction

This is an early-stage MVP with no paid-service requirement for local mock mode. We prefer small changes that are demonstrably correct over broad claims or speculative feature lists.
