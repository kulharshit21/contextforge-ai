# ContextForge documentation

This directory contains detailed guidance for people using, evaluating, contributing to, and maintaining ContextForge. The [project README](../README.md) is the recommended entry point.

## Use the project

| Guide | Purpose |
| --- | --- |
| [Getting started](GETTING_STARTED.md) | Install and use the source-linked CLI or Agent Skill |
| [Architecture](ARCHITECTURE.md) | Understand the journal, Markdown, sync boundaries, APIs and local dashboard |
| [Agent Skill](../.agents/skills/contextforge-memory/SKILL.md) | Instructions available to compatible agent hosts |
| [Demo walkthrough](README_DEMO.md) | Reproducible CLI and seeded dashboard demonstration |
| [Sample outputs](demo/) | Non-sensitive illustrative project memory and capsule |

## Verify claims

| Reference | Purpose |
| --- | --- |
| [Benchmark report](BENCHMARK_RESULTS.md) | Synthetic internal evaluation; read the methodological caveats first |
| [Dependency security audit](DEPENDENCY_AUDIT.md) | Snapshot of package advisories and mitigations |
| [Windows verification](platforms/WINDOWS_VERIFICATION.md) | Reported local walkthrough and commands |
| [macOS verification](platforms/MACOS_VERIFICATION.md) | Reported platform checks and scope |
| [GitHub Actions](https://github.com/kulharshit21/contextforge-ai/actions) | Current automated CI results |

The benchmark is **not** an independently validated measure of real developer outcomes or LLM instruction-injection safety. Methodological issues are tracked in [#28](https://github.com/kulharshit21/contextforge-ai/issues/28).

## Contribute and maintain

- [Contribution guide](../CONTRIBUTING.md)
- [Security reporting](../SECURITY.md)
- [Code of conduct](../CODE_OF_CONDUCT.md)
- [Maintainer runbook](MAINTAINER_RUNBOOK.md)
- [Release checklist](RELEASE_CHECKLIST.md)
- [Changelog](../CHANGELOG.md)
- [Original build plan](AGENT_SKILL_BUILD_PLAN.md) — historical project execution plan, not an external certification

A repository with fewer well-maintained documents is preferable to a large collection of stale or duplicate guides. If a document stops matching the source code, update it alongside the relevant change.
