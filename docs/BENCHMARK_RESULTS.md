# ContextForge Context-Retention Benchmark Results

*Date: 2026-11-05*  
*Related GitHub Issue: #17*  
*Harness: `benchmarks/run_benchmark.py`*  
*Dataset: `benchmarks/fixtures/tasks.json` (30 held-out multi-session tasks)*

---

## 1. Executive Summary & Objective

The goal of this benchmark is to measure whether ContextForge memory retrieval preserves task-critical software engineering facts across multi-session workflows when context budgets are constrained, compared to equal-budget baselines.

In accordance with project guidelines:
- **No inflated claims:** We do not claim ContextForge automatically outperforms or replaces native LLM context compaction.
- **Equal budgets:** All methods are evaluated under identical character constraints (1,200 and 1,800 characters).
- **Truthful reporting:** All results, including negative cases and neutral ties, are documented.

---

## 2. Experimental Methodology

### 2.1 Dataset Composition
- **30 held-out engineering scenarios** spanning 15 distinct domains:
  - Backend APIs (JWT revocation, Stripe webhook idempotency, rate limiting, GraphQL N+1, gRPC deadlines)
  - Databases (connection pool leaks, SQLite WAL concurrency, PostgreSQL GIN indexes, Prisma migration drift, optimistic locking, full-text search)
  - Concurrency & Performance (distributed mutexes, Node.js EventEmitter memory leaks, zero-copy streams)
  - Security & Compliance (CORS misconfiguration, OAuth2 PKCE, partitioned cookies, middleware bypasses, mTLS, mass assignment, audit logging)
  - DevOps & Testing (Docker multi-stage optimization, Kafka consumer rebalance, test worker schema isolation, graceful SIGTERM shutdown)
- **Multi-session structure:** Each task represents 4–6 development sessions totaling 22 events (~1,557 characters of historical notes).
- **Gold facts:** 5 human-verified critical facts per scenario distributed across early architecture decisions (Session 1), root-cause bug discoveries (Session 3), and active blockers/next steps (Session 5).
- **Distractors & noise:** Realistic non-critical events (dependency bumps, lint rules, styling changes, scratch notes).
- **Adversarial injections:** Deliberate prompt injection payloads embedded in historical logs to test safety screening.
- **Superseded items:** Historical decisions explicitly marked as obsolete.

### 2.2 Evaluated Methods (Equal Budget)
1. **Recency Truncation (Recent-N):** Naive reverse-chronological tail truncation until character budget is reached.
2. **Uniform Sampling:** Uniformly distributed historical note sampling across all sessions until budget is reached.
3. **ContextForge Lexical Retrieval:** Kind-prioritized (blockers and next steps first) and task-query lexical keyword ranking, executed via `contextforge_memory.py recall`.

---

## 3. Benchmark Results

### 3.1 Primary Evaluation: Constrained Budget (1,200 Characters / ~300 Tokens)

| Evaluation Metric | Recency Truncation | Uniform Sampling | ContextForge Lexical |
|---|---|---|---|
| **Critical Fact Recall (95% CI)** | 44.7% (±3.2%) | 63.3% (±2.8%) | **86.0% (±5.9%)** |
| **Evidence Citation Fidelity** | 0.0% | 0.0% | **84.7%** |
| **Adversarial Injections Leaked** | 30 / 30 (100%) | 30 / 30 (100%) | **1 / 30 (3.3%)** |
| **Superseded / Stale Info Leakage** | 0.0% | 0.0% | 10.0% |
| **Retrieval Latency (Mean)** | < 1 ms | < 1 ms | **68.0 ms** |

### 3.2 Moderate Budget: Standard Task Capsule (1,800 Characters / ~450 Tokens)

| Evaluation Metric | Recency Truncation | Uniform Sampling | ContextForge Lexical |
|---|---|---|---|
| **Critical Fact Recall (95% CI)** | 64.7% (±3.2%) | 64.7% (±3.2%) | **91.3% (±5.8%)** |
| **Evidence Citation Fidelity** | 0.0% | 0.0% | **89.3%** |
| **Adversarial Injections Leaked** | 30 / 30 (100%) | 30 / 30 (100%) | **3 / 30 (10.0%)** |
| **Superseded / Stale Info Leakage** | 93.3% | 0.0% | 16.7% |
| **Retrieval Latency (Mean)** | < 1 ms | < 1 ms | **68.1 ms** |

---

## 4. Analysis of Negative Cases & Limitations

ContextForge is a local, deterministic, keyword- and kind-prioritized memory system. It does not use neural semantic embeddings or LLM summarization during default offline recall.

### 4.1 Documented Negative Cases (1,200 Character Budget)
Out of 30 evaluated tasks, **2 cases (6.7%)** failed to outperform naive recency:
1. **`task-04-database-connection-pool-leak` (Database):**
   - *ContextForge Recall:* 40%
   - *Recency Recall:* 60%
   - *Root Cause:* The critical bug resolution and PgBouncer blocker occurred in the final two commits. Recency truncation captured both immediately, whereas ContextForge's lexical scoring allocated a portion of the budget to early architectural pool rules, missing the recent runtime flag.
2. **`task-28-schema-validation-stripping` (Security):**
   - *ContextForge Recall:* 60%
   - *Recency Recall:* 60%
   - *Root Cause:* Neutral tie. Both methods captured 3 of the 5 gold facts under the strict 1,200-character cap.

### 4.2 Tradeoffs & Failure Modes
- **Vocabulary Mismatch:** When the incoming task prompt uses terminology absent from the saved memory tags (e.g. "mutual authentication" vs "client certificates"), lexical BM25/keyword scoring degrades.
- **Stale Note Ingestion:** In ~10–16% of scenarios, superseded historical notes containing matching query keywords were included in the output when the superseded link was not explicitly checked.
- **Model-Native Compaction:** Model-native context compaction baselines (e.g. Gemini 2.5 context caching or Claude compaction) were not included in this deterministic offline runner to avoid non-reproducible network latency, temperature variance, and paid API dependencies.

---

## 5. Reproduction & Verification

To reproduce these benchmark numbers locally:

```bash
# Run full benchmark with default 1200 char budget
npm run benchmark

# Or run with custom budget
python benchmarks/run_benchmark.py 1800

# Automated CI regression gate
npm test -- tests/benchmark.test.cjs
```

The benchmark test in `tests/benchmark.test.cjs` is enforced in CI to prevent regressions in critical fact recall, citation alignment, and injection resistance.
