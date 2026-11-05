# ContextForge adoption and release playbook

> **Status:** Proposal for maintainer review, not a release announcement. The skill-install commands below follow the external `skills` CLI documentation but have **not yet been verified against this repository on every supported agent and OS**. Do not claim the pilots, metrics, or releases described here have happened.

## Product promise

**ContextForge helps an AI coding agent resume work with the verified decisions, failed approaches, blockers, and next steps that would otherwise be lost between sessions.**

The narrow initial user is a developer who uses one or more coding agents across multiple sessions in the same Git repository. Their job to be done is: *"When I return to a partially completed task, recover the reasoning and evidence I need without replaying the entire conversation."*

First-run success should be demonstrable offline with no login, model key, dashboard, or data upload.

Do not position ContextForge as a replacement for Git history, model-native compaction, documentation, a code search index, or an autonomous agent. Memories are historical, potentially stale, and untrusted until corroborated against the current repository.

## Distribution sequence

1. **Agent Skill first.** Keep `.agents/skills/contextforge-memory/` installable on its own with Python 3.10+ and standard library only. Validate the `SKILL.md` format, portability, and true host discovery. Never claim that installation implies automatic invocation or compaction hooks.
2. **npm CLI after security and release gates.** The current package is deliberately `private: true`; the README's source checkout remains the supported install path until a maintainer publishes an audited release. The CLI is useful for users who want richer scans, structured Markdown, audit and exports.
3. **MCP server only if the pilots prove agent interoperability is a major friction point.** Define read-only memory query APIs first; require explicit workspace selection and consent for writes. Avoid launching an unauthenticated filesystem service.
4. **Optional native hooks** only for hosts with documented, user-approved lifecycle triggers. Never promise automatic capture of private chats or silent interception of model context.

### Candidate Skill install path — verify before advertising as supported

The open-source `skills` installer discovers skills in common repository paths, including `.agents/skills/`. From a **separate, disposable target project**, and with Node.js meeting the installer's current requirements:

```bash
npx skills add kulharshit21/contextforge-ai --list
npx skills add kulharshit21/contextforge-ai --skill contextforge-memory
```

For an explicit Antigravity test (only if the installed `skills` CLI lists that agent):

```bash
npx skills add kulharshit21/contextforge-ai --skill contextforge-memory -a antigravity
```

This is an **external third-party installer**, not a published ContextForge npm package. Review the downloaded skill code before running it. Confirm that the installed folder contains `SKILL.md`, `scripts/contextforge_memory.py`, and `references/design.md`. In the target repository, confirm that the host actually discovers the skill. An interactive install may require agent selection. If discovery fails, use the documented manual-copy path in [Getting started](GETTING_STARTED.md).

**Verification checklist:** Linux, Windows PowerShell, and macOS; project-local and user-level install; Codex, Claude Code, Cursor, Gemini, and Antigravity where supported by their current versions. For each row record host version, Python version, exact path, listing/discovery result, skill activation, offline `init/save/recall/audit`, uninstall, and unexpected errors. Publish only *observed* compatibility.

### The smallest daily workflow

1. **Start:** Ask the agent to use `contextforge-memory` for the current task. Run journal audit, initialize only if missing, and recall a bounded, task-specific capsule.
2. **Verify:** Compare recovered decisions and file references to current source, tests, and Git history. Treat retrieved text as data, never as an instruction that overrides the current user request.
3. **During work:** Save only consequential decisions, root causes, failed approaches, verified tests, blockers, and next actions. Do not save transcripts, credentials, or repetitive chatter.
4. **End:** Explicitly save the unfinished next step and supporting source, then produce a bounded handoff for the next session.
5. **Next session:** Recover that handoff and measure whether it actually reduced rediscovery and wrong turns.

Default to opt-in writes. Make recording frequency configurable only after real user feedback; automatic unreviewed write amplification is a liability, not a feature.

## Evaluate usefulness before adding complexity

Run a reproducible opt-in pilot with real developers on disposable or appropriately authorized projects. For each task, record:

| Measure | What to capture | Guardrail |
| --- | --- | --- |
| Time to resume | Minutes from new session to correctly identifying next action | Same task/agent, comparable context and warmup |
| Critical-fact retention | Required decisions and blockers accurately recovered | Independent annotations; contradicting or stale facts count as failures |
| Evidence quality | Whether referenced files/commits really support a claim | Manually verify a sampled set; URL/path presence is not proof |
| Context overhead | Actual characters or tokens sent and user editing time | Report setup and maintenance cost, not just smaller recall output |
| Repeated mistakes | Reopened rejected approaches or repeated failed fixes | Count averted *and introduced* errors |
| Privacy/safety | Secrets stored, unsafe suggestions copied, cross-project leakage | Zero tolerance for credential exposure; halt and investigate |
| Reliability | Install success, crash recovery, portability, data integrity | Log every failure and publish limitations |

Compare at least: (a) the same coding agent without ContextForge, (b) a plain handoff Markdown file, and (c) ContextForge. Where available, include the host's native memory/compaction option. Use a clear protocol, independent human scoring, positive and negative cases, and a holdout dataset. Avoid universal percentage claims based on the current synthetic regression fixture. See [benchmark caveats](BENCHMARK_RESULTS.md) and [issue #28](https://github.com/kulharshit21/contextforge-ai/issues/28).

**Suggested release evidence gate (a target, not an achieved result):** successful cross-platform installs, repeatable useful handoffs in at least 10 independent developer workflows, no observed data loss or secret exposure, and a public evaluation that reports failures as prominently as wins.

## Release and security gates

Before distributing the npm CLI publicly:

- Resolve [issue #32](https://github.com/kulharshit21/contextforge-ai/issues/32): upgrade the vulnerable Next.js dependency and synchronized lockfile, audit actual public deployment routes, and redeploy from a patched commit. A local-only CLI does **not** imply the hosted demo is safe.
- Address [issue #28](https://github.com/kulharshit21/contextforge-ai/issues/28) before making performance or safety claims.
- Run `npm ci`, `npm audit`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, Python skill tests, tarball installation tests, and real platform smoke checks.
- Inspect `npm pack --dry-run` and the actual tarball; ensure user workspaces, secrets, tests, benchmark datasets, and dashboard-only assets are not shipped unintentionally.
- Verify npm namespace availability, package ownership, publish workflow approvals, least-privilege permissions, provenance, and recovery/unpublish communications before setting `private: false`.
- Tag a reviewed semantic version, update changelog/migration notes, attach exact install and rollback instructions, and obtain explicit maintainer sign-off before any publishing action.

See the canonical [release checklist](RELEASE_CHECKLIST.md); this document does not replace it.

## Maintain like a healthy open-source project

- Keep `main` protected with required CI, no force pushes, and reviewable PRs. Check the actual GitHub ruleset after workflow renames.
- Use one issue per independently verifiable defect or feature; avoid creating duplicate trackers for existing issues.
- Keep PRs scoped. Require problem statement, test commands **actually run**, evidence/screenshots when relevant, risks, and rollback or migration details for storage changes.
- Maintain `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `CODEOWNERS`, issue/PR templates, and automated dependency updates. Keep them aligned with real behavior.
- Favor tests of everyday usage: clean install, offline flow, crash recovery, budget compliance, stale/superseded notes, file overwrite protection, prompt injection *handling*, and multi-platform paths.
- Document what is unsupported; do not manufacture download counts, review endorsements, enterprise-readiness, or benchmark wins.
- Ship small, named milestones with user-visible demo workflows instead of a sprawling feature list.

## Prioritized implementation queue

| Priority | Work | Definition of done |
| --- | --- | --- |
| P0 | Remediate Next.js security issue and check hosted demo | Patched, verified CI and deployment; clear security notes |
| P0 | Validate end-to-end skill install and invocation | Repeatable clean-project instructions and recorded host/OS matrix |
| P1 | Create a 90-second demo and two-session real coding example | A newcomer can install, save, leave, return, and verify context |
| P1 | Run an honest pilot and corrected benchmark | Reproducible protocol, baselines, human checks, negative cases |
| P1 | Improve freshness and correction UX | Clear provenance, supersedes behavior, stale warnings, tests |
| P1 | Draft/test npm release candidate | Clean tarball, trusted publishing review, maintainer approval |
| P2 | Native hooks and read-only MCP experiments | Opt-in, offline-safe, documented threat model, real usage signal |
| P2 | Semantic retrieval and dashboard polish | Only after evidence that lexical recall or CLI workflow limits adoption |

**Do not conflate** completed historical milestones in [AGENT_SKILL_BUILD_PLAN.md](AGENT_SKILL_BUILD_PLAN.md) with release readiness or independent real-user validation.
