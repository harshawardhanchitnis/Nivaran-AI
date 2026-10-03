# Evaluation report

Dataset SHA-256: `c1f0a919e529fface0a266075a4249043a466d4434ba31529eeb1b5e2e8b3468`. Fixed evaluation date: 2 October 2026 (India).

**5/36 required live runs finished. 1 run(s) interrupted.**
Stage-one saved observations: 6/12. Cases without a saved repetition-one observation: unreadable-image, injected-instruction, mixed-amount-formats, two-refund-dates, written-refusal, bank-reference. These are not completed runs.
Results below include completed failures. Interrupted runs and their spent calls are listed separately.

The runner uses the production reader, quote checks, agent loop, ladder, caller-scoped Postgres transactions and draft generator. It does not test the deployed HTTP/browser journey.
Input documents are synthetic. Expected facts and scripted answers are never included in model context. Answers are supplied only after the matching question is asked.

## Six required measures

| Measure | Measured result |
|---|---|
| Facts correct, per field | See the field table; measured immediately after the first quote check, before any scripted answer. |
| Quote checks passed | 54/54 extracted document quotes; no extracted quotes means N/A, not a pass. This is not extraction coverage. |
| Correct ladder/outcome and pauses | 2/5 outcome/step; 3/5 exact pause sets. |
| Same result over three runs | 0/0 completed triples; 12 case(s) still lack three runs. Consistency does not imply correctness. |
| Seeded linter errors caught | 3/3 deterministic probes (amount, date, ID), run locally without a model. Prose and spelled-out numbers remain outside this test. |
| Model calls and seconds per run | See the run table. Logical calls are charged once; provider attempts include immediate fallback attempts. |

## Field results

| Field | Correct / observed runs | Expected present or conflicting / absent |
|---|---|---|
| merchant_name | 4/5 | 4/1 |
| order_id | 5/5 | 4/1 |
| order_date | 4/5 | 4/1 |
| item_description | 3/5 | 5/0 |
| amount_paid | 3/5 | 4/1 |
| cancellation_or_return_date | 3/5 | 4/1 |
| refund_amount | 3/5 | 4/1 |
| refund_promise_date | 3/5 | 4/1 |
| refund_due_date | 3/5 | 4/1 |
| refund_reference | 5/5 | 0/5 |
| complaint_sent_date | 5/5 | 1/4 |
| complaint_acknowledged | 5/5 | 1/4 |
| complaint_refused | 5/5 | 0/5 |
| refund_received | 2/5 | 4/1 |

## Runs

| Case / repeat | State | Step correct | Pauses correct | Draft kind correct | Logical / provider | Elapsed seconds |
|---|---|---|---|---|---|---|
| already-complained / 1 | finished/waiting_for_user | false | false | false | 5 / 5 | 310.19 |
| clean-overdue / 1 | finished/failed | false | true | false | 14 / 15 | 698.95 |
| conflicting-amounts / 1 | finished/waiting_for_user | false | false | false | 5 / 5 | 309.17 |
| missing-order-id / 1 | interrupted/running: evaluation_budget | N/A | N/A | N/A | 4 / 4 | 309.66 |
| not-yet-due / 1 | finished/plan_ready | true | true | true | 7 / 7 | 373.90 |
| out-of-scope / 1 | finished/out_of_scope | true | true | true | 5 / 5 | 308.78 |

## Answering models and fallbacks

| Case / repeat | Models that answered (responses) | Fallback responses | Provider attempts by model |
|---|---|---|---|
| already-complained / 1 | qwen/qwen3.8-27b: 5 | 0/5 | qwen/qwen3.8-27b: 5 |
| clean-overdue / 1 | qwen/qwen3.8-27b: 12; gemini-3.8-flash: 1; gemini-3.6-flash: 1 | 1/14 | qwen/qwen3.8-27b: 12; gemini-3.6-flash: 2; gemini-3.8-flash: 1 |
| conflicting-amounts / 1 | qwen/qwen3.8-27b: 5 | 0/5 | qwen/qwen3.8-27b: 5 |
| missing-order-id / 1 | qwen/qwen3.8-27b: 4 | 0/4 | qwen/qwen3.8-27b: 4 |
| not-yet-due / 1 | qwen/qwen3.8-27b: 7 | 0/7 | qwen/qwen3.8-27b: 7 |
| out-of-scope / 1 | qwen/qwen3.8-27b: 5 | 0/5 | qwen/qwen3.8-27b: 5 |

A response counts here only after the routed SDK call succeeded; later extraction, tool or draft validation may still fail. A fallback response uses a later lineup model, including when earlier models were skipped on stored cooldown. Attempt counts include failures and are not answering-model counts.
Total spent across recorded runs: **40 logical charges / 41 provider attempts**. These include both Google and Groq, not just Gemini.

| Provider | SDK attempts | Successful routed responses |
|---|---|---|
| Google / Gemini | 3 | 2 |
| Groq / Qwen | 38 | 38 |

## Groq request and token measurements

Elapsed run time includes local pacing waits. Input bytes are serialized payload measurements, not token counts. Prompt/output tokens below come from provider response usage; N/A means no usage was returned. No raw prompts or secrets are retained.

| Case / repeat | Task | Input bytes | Prompt tokens | Output tokens | Output allowance | HTTP status |
|---|---|---|---|---|---|---|
| already-complained / 1 | reading | 2140 | 250 | 19 | 5604 | 200 |
| already-complained / 1 | reading | 2272 | 295 | 20 | 5472 | 200 |
| already-complained / 1 | reading | 2166 | 247 | 177 | 5578 | 200 |
| already-complained / 1 | tool_choice | 5516 | 1645 | 15 | 600 | 200 |
| already-complained / 1 | tool_choice | 5376 | 1593 | 79 | 600 | 200 |
| clean-overdue / 1 | reading | 2140 | 250 | 949 | 5604 | 200 |
| clean-overdue / 1 | reading | 2232 | 287 | 265 | 5512 | 200 |
| clean-overdue / 1 | reading | 2058 | 213 | 19 | 5686 | 200 |
| clean-overdue / 1 | tool_choice | 5934 | 1827 | 15 | 600 | 200 |
| clean-overdue / 1 | tool_choice | 4702 | 1411 | 35 | 600 | 200 |
| clean-overdue / 1 | tool_choice | 4702 | 1411 | 32 | 600 | 200 |
| clean-overdue / 1 | tool_choice | 4702 | 1411 | 38 | 600 | 200 |
| clean-overdue / 1 | tool_choice | 4702 | 1411 | 33 | 600 | 200 |
| clean-overdue / 1 | tool_choice | 4702 | 1411 | 40 | 600 | 200 |
| clean-overdue / 1 | tool_choice | 4702 | 1411 | 39 | 600 | 200 |
| clean-overdue / 1 | tool_choice | 4702 | 1411 | 36 | 600 | 200 |
| clean-overdue / 1 | tool_choice | 4702 | 1411 | 33 | 600 | 200 |
| conflicting-amounts / 1 | reading | 2140 | 250 | 219 | 5604 | 200 |
| conflicting-amounts / 1 | reading | 2272 | 295 | 20 | 5472 | 200 |
| conflicting-amounts / 1 | reading | 2088 | 230 | 143 | 5656 | 200 |
| conflicting-amounts / 1 | tool_choice | 5662 | 1696 | 15 | 600 | 200 |
| conflicting-amounts / 1 | tool_choice | 5522 | 1644 | 71 | 600 | 200 |
| missing-order-id / 1 | reading | 2171 | 250 | 275 | 5573 | 200 |
| missing-order-id / 1 | reading | 2251 | 284 | 317 | 5493 | 200 |
| missing-order-id / 1 | tool_choice | 4809 | 1433 | 80 | 600 | 200 |
| missing-order-id / 1 | reading | 2336 | 273 | 19 | 5408 | 200 |
| not-yet-due / 1 | reading | 2140 | 250 | 260 | 5604 | 200 |
| not-yet-due / 1 | reading | 2272 | 295 | 279 | 5472 | 200 |
| not-yet-due / 1 | tool_choice | 5764 | 1733 | 15 | 600 | 200 |
| not-yet-due / 1 | tool_choice | 4468 | 1304 | 34 | 600 | 200 |
| not-yet-due / 1 | tool_choice | 5228 | 1484 | 44 | 600 | 200 |
| not-yet-due / 1 | tool_choice | 5228 | 1484 | 37 | 600 | 200 |
| not-yet-due / 1 | tool_choice | 5228 | 1484 | 103 | 600 | 200 |
| out-of-scope / 1 | reading | 2177 | 230 | 20 | 5567 | 200 |
| out-of-scope / 1 | tool_choice | 5075 | 1479 | 15 | 600 | 200 |
| out-of-scope / 1 | tool_choice | 4935 | 1427 | 95 | 600 | 200 |
| out-of-scope / 1 | reading | 2399 | 267 | 51 | 5345 | 200 |
| out-of-scope / 1 | tool_choice | 5145 | 1490 | 69 | 600 | 200 |

The per-run JSON preserves actual answering model IDs, events, initial/final facts and failures. It contains only synthetic case data; authentication and signing secrets stay outside these files.

## Injection check

0/3 injection runs completed. A marker check is combined with field, pause and outcome scoring; absence of the marker alone does not establish resistance.

## Limits

Small synthetic set, one fixed date, and only the configured provider lineups. PDF quote matching checks literal source text; image confirmation is a weaker second model pass. No survey results or real consumer outcomes are measured here.
