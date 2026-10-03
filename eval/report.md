# Evaluation report

Dataset SHA-256: `c1f0a919e529fface0a266075a4249043a466d4434ba31529eeb1b5e2e8b3468`. Fixed evaluation date: 2 October 2026 (India).

**0/36 required live runs finished. 0 run(s) interrupted.**
No live product-evaluation results are available yet. Zero is a run count, not an accuracy score.

The runner uses the production reader, quote checks, agent loop, ladder, caller-scoped Postgres transactions and draft generator. It does not test the deployed HTTP/browser journey.
Input documents are synthetic. Expected facts and scripted answers are never included in model context. Answers are supplied only after the matching question is asked.

## Six required measures

| Measure | Measured result |
|---|---|
| Facts correct, per field | See the field table; measured immediately after the first quote check, before any scripted answer. |
| Quote checks passed | 0/0 extracted document quotes; no extracted quotes means N/A, not a pass. This is not extraction coverage. |
| Correct ladder/outcome and pauses | 0/0 outcome/step; 0/0 exact pause sets. |
| Same result over three runs | 0/0 completed triples; 12 case(s) still lack three runs. Consistency does not imply correctness. |
| Seeded linter errors caught | 3/3 deterministic probes (amount, date, ID), run locally without a model. Prose and spelled-out numbers remain outside this test. |
| Model calls and seconds per run | See the run table. Logical calls are charged once; provider attempts include immediate fallback attempts. |

## Field results

| Field | Correct / observed runs | Expected present or conflicting / absent |
|---|---|---|
| merchant_name | 0/0 | 0/0 |
| order_id | 0/0 | 0/0 |
| order_date | 0/0 | 0/0 |
| item_description | 0/0 | 0/0 |
| amount_paid | 0/0 | 0/0 |
| cancellation_or_return_date | 0/0 | 0/0 |
| refund_amount | 0/0 | 0/0 |
| refund_promise_date | 0/0 | 0/0 |
| refund_due_date | 0/0 | 0/0 |
| refund_reference | 0/0 | 0/0 |
| complaint_sent_date | 0/0 | 0/0 |
| complaint_acknowledged | 0/0 | 0/0 |
| complaint_refused | 0/0 | 0/0 |
| refund_received | 0/0 | 0/0 |

## Runs

| Case / repeat | State | Step correct | Pauses correct | Draft kind correct | Logical / provider | Active seconds |
|---|---|---|---|---|---|---|
| No live runs yet | Pending budget approval and database caps | N/A | N/A | N/A | 0 / 0 | N/A |

## Answering models and fallbacks

| Case / repeat | Models that answered (responses) | Fallback responses | Provider attempts by model |
|---|---|---|---|

A response counts here only after the routed SDK call succeeded; later extraction, tool or draft validation may still fail. A fallback response uses a later lineup model, including when earlier models were skipped on stored cooldown. Attempt counts include failures and are not answering-model counts.
Total spent across recorded runs: **0 logical charges / 0 provider attempts**. These include both Google and Groq, not just Gemini.

The per-run JSON preserves actual answering model IDs, events, initial/final facts and failures. It contains only synthetic case data; authentication and signing secrets stay outside these files.

## Injection check

0/3 injection runs completed. A marker check is combined with field, pause and outcome scoring; absence of the marker alone does not establish resistance.

## Limits

Small synthetic set, one fixed date, and only the configured provider lineups. PDF quote matching checks literal source text; image confirmation is a weaker second model pass. No survey results or real consumer outcomes are measured here.
