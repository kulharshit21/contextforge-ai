"""Regression checks for benchmark harness, baselines, and supersession links."""
import tempfile
import unittest
from pathlib import Path

from benchmarks.run_benchmark import (
    baseline_recency,
    baseline_uniform,
    setup_workspace,
)


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

    def test_setup_workspace_chains_and_links_superseded_events(self):
        scenario = {
            "events": [
                {
                    "kind": "decision",
                    "text": "Old plan to use in-memory store",
                    "source": "docs/ARCH.md",
                },
                {
                    "kind": "decision",
                    "text": "Adopt SQLite disk journal",
                    "source": "docs/ARCH.md",
                    "supersedes_event_idx": 0,
                },
            ]
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            events = setup_workspace(scenario, Path(tmpdir))
            self.assertEqual(len(events), 2)
            self.assertIsNone(events[0]["supersedes"])
            self.assertEqual(events[1]["supersedes"], "000000000001")
            self.assertEqual(events[1]["previous"], events[0]["digest"])


if __name__ == "__main__":
    unittest.main()
