#!/usr/bin/env python3
"""Two-session developer workflow demonstration for ContextForge.

Demonstrates:
Session 1: Developer initializes memory, records architecture decisions,
           captures a concurrency bug, documents a failed attempt as a factual record,
           supersedes the initial decision with a verified fix, and notes remaining blockers.
Session 2: A fresh AI coding session recalls task-relevant context within a 1,200-char
           budget, retrieves verified evidence, ignores superseded decisions, and
           avoids repeating the recorded failed attempt.
"""

import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MEMORY_SCRIPT = REPO_ROOT / ".agents" / "skills" / "contextforge-memory" / "scripts" / "contextforge_memory.py"


def run_cmd(args, root, capture=True):
    cmd = [sys.executable, str(MEMORY_SCRIPT), "--root", str(root)] + args
    res = subprocess.run(cmd, capture_output=capture, text=True, check=False)
    return res


def main():
    print("=" * 80)
    print(" CONTEXTFORGE AI - REPRODUCIBLE TWO-SESSION DEVELOPER WORKFLOW DEMO")
    print("=" * 80)

    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)

        # Create dummy source files for evidence verification
        (root / "src" / "db").mkdir(parents=True, exist_ok=True)
        (root / "tests").mkdir(parents=True, exist_ok=True)
        (root / "src" / "db" / "cache.ts").write_text("// Cache implementation\n", encoding="utf-8")
        (root / "src" / "db" / "queue.ts").write_text("// Single-writer queue\n", encoding="utf-8")
        (root / "tests" / "stress.test.ts").write_text("// Concurrency tests\n", encoding="utf-8")

        print("\n--- [SESSION 1] Developer starts project, encounters bug, records fix ---")
        
        # 1. Initialize
        res = run_cmd(["init"], root)
        print(f"[1/6] init: {res.stdout.strip()}")

        # 2. Decision 1
        res = run_cmd(["save", "--kind", "decision", "--text", "Direct multi-process SQLite cache access", "--source", "src/db/cache.ts", "--tag", "cache"], root)
        id_decision1 = res.stdout.strip().replace("Saved: ", "")
        print(f"[2/6] save initial decision: {id_decision1}")

        # 3. Bug
        res = run_cmd(["save", "--kind", "bug", "--text", "SQLITE_BUSY under burst writes across 50 processes", "--source", "src/db/cache.ts", "--tag", "cache,sqlite"], root)
        print(f"[3/6] save bug: {res.stdout.strip()}")

        # 4. Failed attempt (recorded as fact with attempt tag)
        res = run_cmd(["save", "--kind", "fact", "--text", "Attempted increasing busy_timeout to 10000ms; still timed out under load", "--source", "tests/stress.test.ts", "--tag", "cache,attempt"], root)
        print(f"[4/6] save failed attempt: {res.stdout.strip()}")

        # 5. Superseding decision + test
        res = run_cmd(["save", "--kind", "decision", "--text", "Replace direct SQLite access with single-writer worker queue", "--source", "src/db/queue.ts", "--tag", "cache,queue", "--supersedes", id_decision1], root)
        id_decision2 = res.stdout.strip().replace("Saved: ", "")
        print(f"[5/6] save superseding decision (supersedes {id_decision1}): {id_decision2}")

        res = run_cmd(["save", "--kind", "test", "--text", "50-concurrent-writer stress test passes in 420ms with 0 errors", "--source", "tests/stress.test.ts", "--tag", "cache,test"], root)
        print(f"      save verified test: {res.stdout.strip()}")

        # 6. Blocker for next session
        res = run_cmd(["save", "--kind", "blocker", "--text", "Add graceful shutdown drain to the single-writer queue worker", "--source", "src/db/queue.ts", "--tag", "cache,shutdown"], root)
        print(f"[6/6] save next session blocker: {res.stdout.strip()}")

        # Audit
        res = run_cmd(["audit", "--verbose"], root)
        print(f"\nSession 1 Audit Summary:\n{res.stdout.strip()}")

        print("\n" + "=" * 80)
        print("--- [SESSION 2] Fresh AI Coding Session Resumes Work ---")
        print("Task: 'Add graceful shutdown drain to the cache queue worker'")
        print("=" * 80)

        t0 = time.perf_counter()
        recall_res = run_cmd(["recall", "--task", "graceful shutdown drain cache queue", "--budget-chars", "1200"], root)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        output = recall_res.stdout.strip()
        print(f"\nRetrieved Context Capsule (latency: {elapsed_ms:.1f} ms, size: {len(output)} chars):")
        print("-" * 60)
        print(output)
        print("-" * 60)

        # Verification of Session 2 correctness:
        print("\nCorrectness Verifications:")
        has_new_decision = id_decision2 in output or "single-writer worker queue" in output
        has_old_decision = "Direct multi-process SQLite cache access" in output
        has_failed_attempt = "busy_timeout" in output or "timed out" in output
        has_blocker = "graceful shutdown drain" in output

        print(f"  * Superseding decision retrieved:   {'PASS' if has_new_decision else 'FAIL'}")
        print(f"  * Obsolete decision excluded:       {'PASS' if not has_old_decision else 'FAIL (superseded decision leaked!)'}")
        print(f"  * Failed attempt warning retrieved: {'PASS' if has_failed_attempt else 'FAIL'}")
        print(f"  * Next blocker retrieved:           {'PASS' if has_blocker else 'FAIL'}")
        print(f"  * Context budget enforced:          {'PASS' if len(output) <= 1200 else 'FAIL'} ({len(output)}/1200 chars)")


if __name__ == "__main__":
    main()
