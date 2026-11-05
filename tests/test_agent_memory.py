"""Black-box tests for the portable, zero-dependency agent-memory skill."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = (Path(__file__).resolve().parent.parent / ".agents" / "skills" /
          "contextforge-memory" / "scripts" / "contextforge_memory.py")

class AgentMemoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.log = self.root / ".contextforge" / "agent-memory" / "events.jsonl"

    def invoke(self, *arguments, status=0):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--root", str(self.root), *arguments],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, status, result.stdout + result.stderr)
        return result

    def test_init_persistence_and_deduplication(self):
        self.invoke("init")
        first = self.invoke("save", "--kind", "decision",
                            "--text", "Selected SQLite for project state",
                            "--source", "docs/architecture.md").stdout.strip()
        self.assertIn("Saved:", first)
        second = self.invoke("save", "--kind", "decision",
                             "--text", "Selected SQLite for project state",
                             "--source", "docs/architecture.md").stdout
        self.assertIn("Duplicate not saved", second)
        records = [json.loads(line) for line in self.log.read_text().splitlines()]
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["kind"], "decision")
        self.assertIn("OK: 1 records", self.invoke("audit").stdout)

    def test_relevance_order_and_strict_context_budget(self):
        for kind, text in [
            ("fact", "The logo is an orange rocket"),
            ("decision", "Chosen PostgreSQL migrations for the database"),
            ("blocker", "Database migrations require a signed review"),
            ("next", "Run database migration tests before deploy"),
            ("bug", "Broken dashboard padding"),
        ]:
            self.invoke("save", "--kind", kind, "--text", text)
        response = self.invoke("recall", "--task", "database migrations",
                               "--budget-chars", "650").stdout
        self.assertLessEqual(len(response), 650)
        self.assertIn("database", response.lower())
        self.assertIn("untrusted", response)
        self.assertLess(response.find("Database migrations require"), response.find("orange rocket")
                        if "orange rocket" in response else 10**9)
        self.assertNotIn("Broken dashboard padding", response)

    def test_corrections_do_not_erase_history(self):
        self.invoke("save", "--kind", "decision", "--text", "Use MySQL")
        old = json.loads(self.log.read_text().splitlines()[0])["id"]
        self.invoke("save", "--kind", "decision", "--text", "Use SQLite instead",
                    "--supersedes", old)
        handoff = self.invoke("recall", "--task", "database", "--budget-chars", "1600").stdout
        self.assertIn("Use SQLite instead", handoff)
        self.assertNotIn("Use MySQL", handoff)
        self.assertIn("2 records; 1 active", self.invoke("audit").stdout)

    def test_incompatible_log_edit_is_detected(self):
        self.invoke("save", "--kind", "fact", "--text", "Build supports Python")
        content = self.log.read_text()
        self.log.write_text(content.replace("supports Python", "supports Ruby"))
        self.invoke("audit", status=2)
        self.invoke("save", "--kind", "fact", "--text", "Another note", status=2)

    def test_secret_patterns_are_refused(self):
        for value in ["password=supersecretlongvalue", "sk_" + "x" * 25,
                      "-----BEGIN OPENSSH PRIVATE KEY-----", ""]:
            self.invoke("save", "--kind", "fact", "--text", value, status=2)
        self.assertFalse(self.log.exists())

    def test_nonexistent_project_fails_safely(self):
        missing = self.root / "not-a-folder"
        result = subprocess.run([sys.executable, str(SCRIPT), "--root", str(missing), "init"],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)

if __name__ == "__main__":
    unittest.main()
