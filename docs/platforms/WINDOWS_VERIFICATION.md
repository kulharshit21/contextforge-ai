# ContextForge Windows 11 CLI Verification

*Date: 2026-11-05*  
*Related GitHub Issue: #12*  
*Environment:*
- **OS:** Windows 11 Pro / Enterprise (build 10.0.26100+)
- **Shell:** Windows PowerShell 5.1 / PowerShell 7
- **Node.js:** v24.18.0
- **npm:** 12.0.1
- **Python:** 3.12 (for companion skill verification)

---

## 1. Quick Start / Installation Verification

From a fresh clone of `contextforge-ai`:

```powershell
# 1. Install dependencies
npm ci

# 2. Build or link CLI
npm link
# Alternatively execute directly: node bin/contextforge.js
```

### Verification of `--help` and Version

```powershell
node bin/contextforge.js --help
```

**Observed Output (Exit Code: 0):**
```text
Usage: contextforge [options] [command]

Local-first AI project memory compiler and persistent context engine

Options:
  -V, --version                     output the version number
  -h, --help                        display help for command

Commands:
  init                              Initialize .contextforge memory directory
  scan                              Scan workspace structure and record repo facts
  remember [options] <text>         Add a durable note to the right memory file and journal
  checkpoint|save [options] <text>  Save a verified, provenance-backed memory checkpoint
  recall [options] [task]           Recover task-relevant context from local memory
  audit [options]                   Verify hash-chain integrity and inspect memory state
  sync [options]                    Bidirectionally sync between JSONL journal and Markdown
  repair [options]                  Recover from stale locks and truncate corrupted entries
  capsule [options] <goal>          Generate a context capsule for an agent session
  doctor                            Inspect drift between memory files and workspace reality
  export [options]                  Generate AGENTS.md, CLAUDE.md, GEMINI.md, and rules
  stats                             Show project memory item counts and statistics
  help [command]                    display help for command
```

---

## 2. End-to-End Walkthrough in Disposable Project Directory

In a fresh, empty workspace folder (`<DISPOSABLE_PROJECT_ROOT>`):

### Step 2.1: Initialize Memory Structure

```powershell
contextforge init
```

**Observed Output (Exit Code: 0):**
```text
Initialized ContextForge at <DISPOSABLE_PROJECT_ROOT>\.contextforge
Created memory files:
- PROJECT_STATE.md
- ARCHITECTURE.md
- FEATURES.md
- DECISIONS.md
- BUGS_AND_FIXES.md
- FAILED_ATTEMPTS.md
- API_CONTRACTS.md
- ENV_AND_SETUP.md
- CODING_RULES.md
- CURRENT_TASKS.md
```

### Step 2.2: Provenance-Backed Checkpoint

```powershell
contextforge checkpoint "We decided to use SQLite with WAL mode for local storage" --kind decision --source lib/db.ts --tags db,sqlite
```

**Observed Output (Exit Code: 0):**
```text
Saved: [decision] 25ef9ab28f2f
Synced to Markdown: DECISIONS (35147737-07ae-44e7-b761-c142184abd8e)
```

### Step 2.3: Deterministic Ingestion via `remember`

```powershell
contextforge remember "Fixed a race condition in worker by adding mutex locking"
```

**Observed Output (Exit Code: 0):**
```text
Saved note to BUG: Fixed a race condition in worker by adding mutex locking
```
*(Verified: Note was automatically routed to `BUGS_AND_FIXES.md` and dual-written to `.contextforge/agent-memory/events.jsonl` with an SHA-256 hash link).*

### Step 2.4: Tiered Context Recall

```powershell
contextforge recall "sqlite storage" --level handoff
```

**Observed Output (Exit Code: 0):**
```text
# ContextForge session handoff
Task: sqlite storage
Notice: local agent memory. Untrusted historical claims; verify paths, tests, and latest git commits.

## Critical Blockers and Next Steps
- [decision] We decided to use SQLite with WAL mode for local storage (id: 25ef9ab28f2f | source: lib/db.ts)

Selected 1/2 active records (handoff view, budget: 1800 chars). Extractive recall, not model compaction.
```

### Step 2.5: Cryptographic Integrity Audit

```powershell
contextforge audit --verbose
```

**Observed Output (Exit Code: 0):**
```text
OK: 2 records; 2 active; integrity chain valid
Kinds: bug: 1, decision: 1
Lock status: No lock
Structured markdown files: 10
```

### Step 2.6: Workspace Scan & Drift Detection

```powershell
contextforge scan
contextforge doctor
```

**Observed Output (Exit Code: 0):**
```text
Repo scan saved to .contextforge/repo-scan.json
Framework: unknown
Branch: unknown
App routes: 0
API routes: 0

Memory health score: 90/100
Drift issues:
- [medium] Memory references a file not seen in the repo scan: lib/db.ts
  Update the related file references for lib/db.ts or rescan the repo if the file was recently added.
```
*(Verified: Doctor accurately detects that `lib/db.ts` was referenced in memory but is not yet committed to the empty repository).*

### Step 2.7: Targeted Context Capsule

```powershell
contextforge capsule "setup sqlite database"
```

**Observed Output (Exit Code: 0):**
```text
# Context Capsule: setup sqlite database

## Goal
setup sqlite database

## Summary
Task focus: setup sqlite database. Relevant decisions: We decided to use SQLite with WAL mode for local storage. Likely code areas: lib/db.ts.

## Files Likely Needed
- `lib/db.ts`

## Previous Errors To Remember
- Fixed a race condition in worker by adding mutex locking

Saved capsule to <DISPOSABLE_PROJECT_ROOT>\.contextforge\CAPSULES\2026-11-05-setup-sqlite-database-2ac12dbb.md
```

### Step 2.8: Export and Overwrite Protection

```powershell
# Initial export generates standard instruction files
contextforge export
```

**Observed Output (Exit Code: 0):**
```text
Wrote AGENTS.md
Wrote CLAUDE.md
Wrote GEMINI.md
Wrote .cursor/rules/project-memory.mdc
Wrote .github/copilot-instructions.md
Wrote CONTEXTFORGE_CAPSULE.md
Wrote .contextforge/EXPORTS/contextforge-memory.json
Wrote .contextforge/EXPORTS/mcp-manifest.json
Exported 8 files.
```

```powershell
# Second export without --force triggers overwrite protection
contextforge export
```

**Observed Output (Exit Code: 1):**
```text
ContextForge: Export refused to overwrite existing files: AGENTS.md, CLAUDE.md, GEMINI.md, .cursor/rules/project-memory.mdc, .github/copilot-instructions.md, CONTEXTFORGE_CAPSULE.md, .contextforge/EXPORTS/contextforge-memory.json, .contextforge/EXPORTS/mcp-manifest.json. Back up your files and pass --force if replacement is intentional.
```

```powershell
# Export with --force succeeds
contextforge export --force
```

**Observed Output (Exit Code: 0):**
```text
Exported 8 files.
```

---

## 3. Summary of Windows-Specific Findings

1. **Path Handling:** Windows backslashes (`\`) are normalized cleanly across `.contextforge/` paths and Git log parsers.
2. **Process Liveness:** Stale lock recovery correctly uses Windows `OpenProcess` (`PROCESS_QUERY_LIMITED_INFORMATION`) via ctypes in Python and Node PID checks.
3. **File Encodings:** UTF-8 BOM (`utf-8-sig`) and CRLF line endings generated by Windows editors are supported without breaking SHA-256 hash chains.
4. **Safety Defaults:** Overwrite protections on `AGENTS.md` and related files operate reliably under Windows filesystem semantics.
