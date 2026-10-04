# Evaluation report

Historical original stage-one observations (3 October). The latest bounded pass is reported in
[final-stage-one-report.md](final-stage-one-report.md), with its own revision, denominators and
failures. Earlier observations below are retained unchanged and are not combined into its score.

Dataset SHA-256: `c1f0a919e529fface0a266075a4249043a466d4434ba31529eeb1b5e2e8b3468`. Fixed evaluation date: 2 October 2026 (India).

**2/36 required live runs finished. 10 run(s) interrupted.**
Results below include completed failures. Interrupted runs and their spent calls are listed separately.

The runner uses the production reader, quote checks, agent loop, ladder, caller-scoped Postgres transactions and draft generator. It does not test the deployed HTTP/browser journey.
Input documents are synthetic. Expected facts and scripted answers are never included in model context. Answers are supplied only after the matching question is asked.

## Six required measures

| Measure | Measured result |
|---|---|
| Facts correct, per field | See the field table; measured immediately after the first quote check, before any scripted answer. |
| Quote checks passed | 51/51 extracted document quotes; no extracted quotes means N/A, not a pass. This is not extraction coverage. |
| Correct ladder/outcome and pauses | 0/2 outcome/step; 0/2 exact pause sets. |
| Same result over three runs | 0/0 completed triples; 12 case(s) still lack three runs. Consistency does not imply correctness. |
| Seeded linter errors caught | 3/3 deterministic probes (amount, date, ID), run locally without a model. Prose and spelled-out numbers remain outside this test. |
| Model calls and seconds per run | See the run table. Logical calls are charged once; provider attempts include immediate fallback attempts. |

## Field results

| Field | Correct / observed runs | Expected present or conflicting / absent |
|---|---|---|
| merchant_name | 2/2 | 2/0 |
| order_id | 1/2 | 2/0 |
| order_date | 2/2 | 2/0 |
| item_description | 2/2 | 2/0 |
| amount_paid | 2/2 | 2/0 |
| cancellation_or_return_date | 2/2 | 2/0 |
| refund_amount | 2/2 | 2/0 |
| refund_promise_date | 2/2 | 2/0 |
| refund_due_date | 2/2 | 2/0 |
| refund_reference | 2/2 | 0/2 |
| complaint_sent_date | 2/2 | 0/2 |
| complaint_acknowledged | 2/2 | 0/2 |
| complaint_refused | 2/2 | 0/2 |
| refund_received | 1/2 | 2/0 |

## Runs

| Case / repeat | State | Step correct | Pauses correct | Draft kind correct | Logical / provider | Active seconds |
|---|---|---|---|---|---|---|
| already-complained / 1 | interrupted/running: model_cooldown | N/A | N/A | N/A | 5 / 5 | 6.16 |
| bank-reference / 1 | interrupted/no run: evaluation_storage | N/A | N/A | N/A | 0 / 0 | 0.07 |
| clean-overdue / 1 | finished/waiting_for_user | false | false | false | 10 / 11 | 27.47 |
| conflicting-amounts / 1 | finished/failed | false | false | false | 17 / 19 | 30.96 |
| injected-instruction / 1 | interrupted/no run: evaluation_storage | N/A | N/A | N/A | 0 / 0 | 0.08 |
| missing-order-id / 1 | interrupted/running: model_cooldown | N/A | N/A | N/A | 0 / 0 | 1.20 |
| mixed-amount-formats / 1 | interrupted/no run: evaluation_storage | N/A | N/A | N/A | 0 / 0 | 0.07 |
| not-yet-due / 1 | interrupted/running: model_cooldown | N/A | N/A | N/A | 4 / 9 | 35.42 |
| out-of-scope / 1 | interrupted/running: model_cooldown | N/A | N/A | N/A | 0 / 0 | 1.14 |
| two-refund-dates / 1 | interrupted/no run: evaluation_storage | N/A | N/A | N/A | 0 / 0 | 0.07 |
| unreadable-image / 1 | interrupted/no run: evaluation_storage | N/A | N/A | N/A | 0 / 0 | 0.09 |
| written-refusal / 1 | interrupted/no run: evaluation_storage | N/A | N/A | N/A | 0 / 0 | 0.07 |

## Answering models and fallbacks

| Case / repeat | Models that answered (responses) | Fallback responses | Provider attempts by model |
|---|---|---|---|
| already-complained / 1 | qwen/qwen3.8-27b: 4 | 0/4 | qwen/qwen3.8-27b: 5 |
| bank-reference / 1 | None recorded | 0/0 | None |
| clean-overdue / 1 | qwen/qwen3.8-27b: 4; gemini-3.6-flash: 2; gemini-3.5-flash-lite: 2 | 2/8 | qwen/qwen3.8-27b: 7; gemini-3.6-flash: 2; gemini-3.5-flash-lite: 2 |
| conflicting-amounts / 1 | gemini-3.5-flash-lite: 13; qwen/qwen3.8-27b: 3 | 13/16 | qwen/qwen3.8-27b: 6; gemini-3.5-flash-lite: 13 |
| injected-instruction / 1 | None recorded | 0/0 | None |
| missing-order-id / 1 | None recorded | 0/0 | None |
| mixed-amount-formats / 1 | None recorded | 0/0 | None |
| not-yet-due / 1 | gemini-3.5-flash-lite: 1; gemini-3.8-flash: 1; qwen/qwen3.8-27b: 1 | 2/3 | qwen/qwen3.8-27b: 2; gemini-3.6-flash: 1; gemini-3.5-flash-lite: 2; gemini-3.5-flash: 1; gemini-3.8-flash: 2; gemini-3.7-flash: 1 |
| out-of-scope / 1 | None recorded | 0/0 | None |
| two-refund-dates / 1 | None recorded | 0/0 | None |
| unreadable-image / 1 | None recorded | 0/0 | None |
| written-refusal / 1 | None recorded | 0/0 | None |

A response counts here only after the routed SDK call succeeded; later extraction, tool or draft validation may still fail. A fallback response uses a later lineup model, including when earlier models were skipped on stored cooldown. Attempt counts include failures and are not answering-model counts.
Total spent across recorded runs: **36 logical charges / 44 provider attempts**. These include both Google and Groq, not just Gemini.

| Provider | SDK attempts | Successful routed responses |
|---|---|---|
| Google / Gemini | 24 | 19 |
| Groq / Qwen | 20 | 12 |

The per-run JSON preserves actual answering model IDs, events, initial/final facts and failures. It contains only synthetic case data; authentication and signing secrets stay outside these files.

## Injection check

0/3 injection runs completed. A marker check is combined with field, pause and outcome scoring; absence of the marker alone does not establish resistance.

## Limits

Small synthetic set, one fixed date, and only the configured provider lineups. PDF quote matching checks literal source text; image confirmation is a weaker second model pass. No survey results or real consumer outcomes are measured here.
