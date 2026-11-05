# ContextForge macOS CLI Verification

*Date: 2026-11-05*  
*Related GitHub Issue: #12*  
*Environment:*
- **OS:** macOS 14 (Sonoma) / macOS 15 (Sequoia) (Apple Silicon arm64 & Intel x86_64)
- **CI Runner:** `macos-latest` (GitHub Actions workflow run 41953876854)
- **Shell:** zsh / bash
- **Node.js:** v24.x
- **Python:** 3.12 (for companion skill verification)

---

## 1. Quick Start / Installation Verification

From a fresh clone of `contextforge-ai`:

```bash
# 1. Install dependencies
npm ci

# 2. Link CLI binary locally
npm link
# Or run directly with Node:
node bin/contextforge.js --help
```

---

## 2. Command Workflow & Behavior

### 2.1 Initialization
```bash
contextforge init
```
- Creates `.contextforge/` directory and 10 durable Markdown memory files (`DECISIONS.md`, `CURRENT_TASKS.md`, `BUGS_AND_FIXES.md`, etc.).
- Initializes `.contextforge/agent-memory/events.jsonl` with genesis hash `0000000000000000000000000000000000000000000000000000000000000000`.

### 2.2 Checkpointing & Automatic Classification
```bash
# Explicit kind and provenance
contextforge checkpoint "Chose Redis sorted sets for rate limiting" --kind decision --source lib/limiter.ts --tags redis,ratelimit

# Automatic classification
contextforge remember "Fixed WebSocket disconnect leak by unregistering listeners on close"
```
- Notes are dual-written to structured Markdown and the append-only SHA-256 JSONL journal.

### 2.3 Tiered Recall
```bash
contextforge recall "rate limiting" --level handoff
```
- Recovers kind-prioritized records within the configured character budget (default 1800 chars for `handoff`, 4500 for `capsule`, 8000 for `evidence`).

### 2.4 Audit & Integrity
```bash
contextforge audit --verbose
```
- Validates the complete SHA-256 hash-chain.
- Confirms zero corruptions and reports active writer lock status.

### 2.5 Scan, Doctor & Capsule
```bash
contextforge scan
contextforge doctor
contextforge capsule "implement rate limiting"
```
- `scan` captures framework, git branch, commit hash, and application routes.
- `doctor` detects missing scripts, deleted paths, framework mismatches, and undocumented environment variables.
- `capsule` produces an evidence-backed task context capsule under `.contextforge/CAPSULES/`.

### 2.6 Agent Instructions Export & Overwrite Guard
```bash
# Initial export
contextforge export

# Re-running without --force safely aborts with exit code 1
contextforge export
# ContextForge: Export refused to overwrite existing files: AGENTS.md, ... Pass --force if replacement is intentional.

# Overwrite with --force
contextforge export --force
```

---

## 3. macOS-Specific Implementation Details

1. **Process Liveness Checks:**
   - Under macOS/Unix, writer lock recovery uses `os.kill(pid, 0)` in Python and `process.kill(pid, 0)` in Node to detect active vs orphaned processes without sending terminating signals.
2. **Filesystem Case Sensitivity:**
   - Default APFS is case-insensitive, case-preserving. File keys (`DECISIONS.md` vs `decisions.md`) are stored in canonical uppercase to ensure portability between macOS and Linux CI environments.
3. **Symlink Boundary Protection:**
   - The memory engine verifies `lstat()` on macOS to reject symlink traversal across `.contextforge`, `agent-memory`, and `.writer-lock`.
4. **CI Matrix Evidence:**
   - Automated regression tests (`tests/test_agent_memory.py` and `tests/*.test.cjs`) run continuously on GitHub Actions `macos-latest` runners.
