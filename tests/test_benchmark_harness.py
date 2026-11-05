"""Regression checks for fair source-string budgeting in synthetic baselines."""
import unittest

from benchmarks.run_benchmark import baseline_recency, baseline_uniform


class BenchmarkBaselineTests(unittest.TestCase):
    def setUp(self):
        self.events = [
            {
                "kind": "decision",
                "text": "Use a local SQLite cache",
                "source": "docs/CACHE.md",
            },
            {
                "kind": "blocker",
                "text": "SQLite restore needs a crash test",
                "source": "tests/restore.test.ts",
            },
        ]

    def test_recency_includes_source_within_budget(self):
        text, selected, _ = baseline_recency(self.events, 256)
        self.assertEqual(len(selected), 2)
        self.assertIn("source: docs/CACHE.md", text)
        self.assertIn("source: tests/restore.test.ts", text)
        self.assertLessEqual(len(text), 256)

    def test_uniform_includes_source_within_budget(self):
        text, selected, _ = baseline_uniform(self.events, 256)
        self.assertEqual(len(selected), 2)
        self.assertIn("source: docs/CACHE.md", text)
        self.assertIn("source: tests/restore.test.ts", text)
        self.assertLessEqual(len(text), 256)

    def test_no_baseline_emits_unbudgeted_source_text(self):
        for method in (baseline_recency, baseline_uniform):
            text, selected, _ = method(self.events, 40)
            self.assertLessEqual(len(text), 40)
            self.assertFalse(selected)


if __name__ == "__main__":
    unittest.main()
