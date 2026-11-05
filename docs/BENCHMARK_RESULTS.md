# ContextForge benchmark: internal synthetic-fixture evaluation

**Status: methodological corrections applied; internal synthetic-fixture evaluation.**  
**Recorded:** November 5, 2026  
**Runner:** [`benchmarks/run_benchmark.py`](../benchmarks/run_benchmark.py)  
**Fixtures:** [`benchmarks/fixtures/tasks.json`](../benchmarks/fixtures/tasks.json)  
**Correction tracker:** [issue #28](https://github.com/kulharshit21/contextforge-ai/issues/28)

ContextForge includes a deterministic regression benchmark to check whether lexical retrieval retains selected facts from synthetic multi-session development histories. The numbers below were reported by the updated harness with fair source-budgeting and explicit superseding links. **They are regression checks on synthetic fixtures, not validated measures of human developer productivity, model-native compaction superiority, or practical prompt-injection safety.**

## What the test actually does

The fixture generation script creates 30 synthetic engineering scenarios with tasks, events, predefined gold fact keywords, sources and distractors. The benchmark runs three selectors over those same fixtures at fixed character budgets:

- Recent-first record selection (`recency_truncation`).
- Uniformly shuffled record selection with a fixed random seed (`uniform_sampling`).
- ContextForge's local keyword/type-prioritized recall (`contextforge_lexical`).

The evaluator marks a gold fact as found when at least 60% of its specified keywords appear in the returned string. It checks whether a source string appears for citations and counts verbatim occurrences of adversarial test phrases.

**All 30 fixtures are stored in the repository and repeatedly evaluated by CI.** There is currently no claim of independent human adjudication, unseen real-world developer workflows, or a separate final holdout set.

## Updated benchmark results (fair source accounting & supersession)

Measurements taken across all 30 synthetic scenarios at a fixed 1,200-character budget (~300 tokens):

| Metric at 1,200-character budget | Recent-first | Uniform shuffle | ContextForge Lexical |
| --- | ---: | ---: | ---: |
| Keyword-based gold-fact recall (95% CI) | 44.0% (+/- 3.0%) | 63.3% (+/- 2.8%) | 83.3% (+/- 5.6%) |
| Source-string presence (fair budget accounting) | 58.7% | 76.7% | 84.7% |
| Suspicious payload strings emitted* (30 fixtures) | 30 | 30 | 1 |
| Stale/superseded records leaked | 0.0% | 0.0% | 0.0% |
| Average retrieval latency (end-to-end) | < 1 ms | < 1 ms | ~74 ms |

\* **Note on suspicious text:** Counts verbatim appearances of adversary test phrases in the retrieved context string. This serves as a keyword-exclusion proxy, **not** proof of downstream agent safety or prompt-injection neutralization.

### Negative and neutral cases

The harness tracks negative and neutral cases where ContextForge recall was less than or equal to simple recency:

- `task-04-database-connection-pool-leak` (database): ContextForge recall 40% vs Recency 60%.
- `task-28-schema-validation-stripping` (security): ContextForge recall 60% vs Recency 60%.

These occurred because critical facts in those scenarios were clustered in the most recent session, allowing naive recency truncation to capture them without search overhead.

## Methodological corrections applied (Issue #28)

In accordance with [issue #28](https://github.com/kulharshit21/contextforge-ai/issues/28), the following corrections have been implemented:

1. **Fair source-reference accounting:** Baselines format and account for source references (`(source: path/to/file)`) within their allotted character budget. This eliminated the previous defect where baselines were penalized with artificial 0% citation rates. Under fair budgeting, recency achieves 58.7% and uniform sampling achieves 76.7% source-string presence.
2. **Explicit supersession linking:** Synthetic fixtures now contain explicit `supersedes_event_idx` links, and `setup_workspace()` populates valid 12-character hex ID pointers in `events.jsonl`. This exercises the journal's hash-chain supersession filtering (`getActiveEvents`).
3. **Metric renaming & honest claims:** The metric formerly termed "injections neutralized" is renamed to `suspicious_payloads_emitted` ("Suspicious text"). Documentation explicitly clarifies that exact string absence is not an agent security or prompt-injection defense guarantee.
4. **Transparent negative cases:** Non-superior outcomes are printed and logged directly in `results.json` rather than hidden.
5. **Scope qualification:** The evaluation is documented strictly as a synthetic regression harness rather than generalizable human coding performance.

## What we can responsibly say today

- The harness is deterministic, reproducible, and suitable for catching regressions in memory indexing and recall heuristics.
- On these 30 synthetic fixtures, ContextForge's type- and keyword-prioritized selector achieves higher gold-keyword recall (83.3%) than naive recency (44.0%) or uniform sampling (63.3%) within a tight 1,200-character budget.
- Source presence and suspicious string exclusion are synthetic proxies, **not validated measures of real-world citation correctness or prompt-injection safety**.
- Real-world evaluation with human developers and model-native compaction baselines remains future work.

## Reproduce

~~~bash
npm ci
npm run benchmark
python benchmarks/run_benchmark.py 1200
npm test
~~~

The runner outputs summary statistics and persists complete task breakdowns to `benchmarks/results.json`.
