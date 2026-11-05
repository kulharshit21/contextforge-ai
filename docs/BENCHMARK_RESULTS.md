# ContextForge benchmark: internal synthetic-fixture evaluation

**Status: preliminary; methodological corrections pending.**  
**Recorded:** November 5, 2026  
**Runner:** [`benchmarks/run_benchmark.py`](../benchmarks/run_benchmark.py)  
**Fixtures:** [`benchmarks/fixtures/tasks.json`](../benchmarks/fixtures/tasks.json)  
**Correction tracker:** [issue #28](https://github.com/kulharshit21/contextforge-ai/issues/28)

ContextForge includes a deterministic regression benchmark to check whether lexical retrieval retains selected facts from synthetic multi-session development histories. The numbers below were reported by the current harness. **They are not validated measures of human project-memory performance, model-native compaction superiority, or practical prompt-injection safety.**

## What the test actually does

The fixture generation script creates 30 synthetic engineering scenarios with tasks, events, predefined gold fact keywords, sources and distractors. The benchmark runs three selectors over those same fixtures at fixed character budgets:

- Recent-first record selection.
- Uniformly shuffled record selection with a fixed random seed.
- ContextForge's local keyword/type-prioritized recall.

The evaluator marks a gold fact as found when at least 60% of its specified keywords appear in the returned string. It checks whether a source string appears for citations and whether an exact adversarial string appears for potential injection exposure.

**All 30 fixtures are included in the repository and repeatedly used by CI.** There is currently no evidence of independent human adjudication, unseen developer workflows, or a separate final holdout set. The fixture labels were authored/generated within the project and should not be described as independently human-verified.

## Previously recorded results (not a fair externally validated comparison)

These are historical outputs from the original harness, retained for traceability while [issue #28](https://github.com/kulharshit21/contextforge-ai/issues/28) is resolved.

| Metric at 1,200-character nominal budget | Recent-first | Uniform shuffle | ContextForge |
| --- | ---: | ---: | ---: |
| Keyword-based gold-fact recall | 44.7% | 63.3% | 86.0% |
| Source-string presence among gold facts | 0.0% | 0.0% | 84.7% |
| Exact suspicious payload strings emitted (30 fixtures) | 30 | 30 | 1 |
| Average retrieval latency (original report) | under 1 ms | under 1 ms | about 68 ms |

At 1,800 characters, the original runner reported 64.7% recent-first recall, 64.7% uniform recall, and 91.3% ContextForge recall. These are **historical regression measurements**, not a claim of generalization.

The original report also included confidence intervals. Those intervals describe variation among these 30 synthetic scenarios, **not uncertainty over all real software-development tasks**.

## Known methodology defects

### 1. Source-reference comparison is asymmetric

The recent-first and uniform baselines count a source reference toward their character budget, but their emitted text omits that source. The evaluator then awards them zero citation presence by construction. The citation results therefore **cannot support a superiority claim** until all selectors use comparable output formats.

### 2. The stale/superseded test is incomplete

Fixtures mark some events `is_superseded`, but `setup_workspace()` currently writes `supersedes: None` to every event. That does not exercise the journal's actual superseding link. Current stale-leak numbers must not be used as validated evidence that a history is correctly retired.

### 3. Exact-string filtering is not agent-injection resistance

The "injection leaked" figure is based on whether a malicious-looking fixture string appears in the output. It does **not** run a downstream agent, observe instruction following, or establish an actual attack-success or neutralization rate. It is a potentially useful *payload-inclusion regression check*, not a security guarantee.

### 4. Gold-fact recall is a keyword proxy

Matching 60% of hand-authored fixture keywords is not equivalent to checking that the selected content accurately preserves the full meaning of a decision. A record might match the keywords while contradicting the true project state.

### 5. The dataset isn't an independent unseen test

The scenario generator, test fixtures, retrieval heuristics and gate are all present in one repository. Passing an 80% recall gate on this dataset is good as a regression check, but it does not demonstrate performance on unrelated real projects.

### 6. Context budgets and latency need normalization

The algorithms have different serialization and process overhead. Compare actually emitted output sizes, account for headers and references equally, and report retrieval-only latency separately from Python process startup. There is no model-native compaction baseline in the current test.

## What we can responsibly say today

- The harness is executable and suitable for detecting some regressions on its stored synthetic fixtures.
- In the original run, ContextForge's keyword selector recovered more predefined fact keywords than the two basic synthetic-history selectors.
- The source-citation and injection numbers are **not valid evidence of real-world citation fidelity or protection against agent instruction attacks**.
- We need a fair re-run, genuine independent task annotations and more realistic baselines before making public performance claims.

## Reproduce and improve

~~~bash
npm ci
npm run benchmark
python benchmarks/run_benchmark.py 1800
npm test
~~~

The runner writes `benchmarks/results.json`. Review the script and resulting JSON before quoting numbers. To improve this benchmark, follow the acceptance criteria in [issue #28](https://github.com/kulharshit21/contextforge-ai/issues/28): make baselines comparable, represent supersession correctly, use honest metric names, split held-out evaluation from CI fixtures, and publish positive **and negative** cases.

We welcome reproducible evaluation contributions; see [CONTRIBUTING.md](../CONTRIBUTING.md).
