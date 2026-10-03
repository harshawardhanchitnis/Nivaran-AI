# T12 stage one — 3 October 2026

The owner approved one run of each of the twelve cases, followed by a stop and report.
Stage two requires another owner reply. The owner confirmed applying temporary caps of 300/300
with India-date SQL. The repository SQL now matches the original usage-counter function.

The live command selected repetition 1 only, continued to the next case after recording an
interruption, and cleaned up only completed synthetic cases after saving their audit. It used
the committed corpus and production operations, fixed evaluation date 2 October, existing
anonymous caller and caller-scoped database/storage clients. No retry sleeps or SDK retries ran.

**36 logical charges / 44 SDK attempts** were spent. The caller's database counter for 3 October
in India was initially absent and subsequently 36. Protected global settings/counters cannot be
read by this caller; the owner's SQL screenshot supplies the cap confirmation. No quota bypass
or administrative key was used. Budget remaining: **264 logical charges / 406 SDK attempts**.

| Model | Attempts | Successful routed responses |
|---|---|---|
| qwen/qwen3.8-27b (Groq) | 20 | 12 |
| gemini-3.5-flash-lite | 17 | 16 |
| gemini-3.6-flash | 3 | 2 |
| gemini-3.8-flash | 2 | 1 |
| gemini-3.5-flash | 1 | 0 |
| gemini-3.7-flash | 1 | 0 |

Thus **24 attempts went to Gemini, 20 to Groq**. The 300 budget is for logical calls across both,
not 300 Gemini calls. A logical call may attempt multiple models. A successful routed response
can still fail later validation or lead to a wrong tool/outcome. Seventeen of 31 successful
responses used a later lineup model, including skips of the primary on stored cooldown.
`eval/report.md` lists actual answering models and fallback counts for every individual run.

| Case | Result | Logical / SDK |
|---|---|---|
| clean-overdue | Finished failure: false order-ID conflict, unexpected question, no draft | 10 / 11 |
| conflicting-amounts | Finished failure: repeated rereads reached ten-choice ceiling, no draft | 17 / 19 |
| not-yet-due | Interrupted by cooldown before completion; code had selected step zero | 4 / 9 |
| already-complained | Interrupted by cooldown | 5 / 5 |
| out-of-scope | Interrupted by cooldown before any provider attempt | 0 / 0 |
| missing-order-id | Interrupted by cooldown before any provider attempt | 0 / 0 |
| unreadable-image | Case creation blocked at ten-case limit; no run | 0 / 0 |
| injected-instruction | Case creation blocked at ten-case limit; no run | 0 / 0 |
| mixed-amount-formats | Case creation blocked at ten-case limit; no run | 0 / 0 |
| two-refund-dates | Case creation blocked at ten-case limit; no run | 0 / 0 |
| written-refusal | Case creation blocked at ten-case limit; no run | 0 / 0 |
| bank-reference | Case creation blocked at ten-case limit; no run | 0 / 0 |

All 12 were attempted; only two reached a scored endpoint, and both failed. The other ten are
interruptions, not completed model evaluations. The first reader treated the synthetic-document
footer as `order_id`; its literal quote passed matching, demonstrating that quote existence does
not establish field relevance. One customer-status extraction failed on an empty quote. The
agent later supplied unrelated ID choices. The amount-conflict agent repeatedly reread the
refund message rather than asking the required conflict question, then reached the step ceiling.
No draft, full injection result, complete three-run consistency measure or consumer outcome exists.

Stored provider cooldown reasons at the stop were: Qwen and Flash Lite rate-limit; Flash 3.5/3.8
timeout; Flash 3.6/3.7 high demand. This does **not** show exhausted daily quotas. Immediate
sequential calls can exhaust minute limits even when daily quota remains. No additional calls
were made after the first-stage command stopped.

Four interrupted evaluation cases remain hosted for inspection/resumption, alongside six earlier
fixtures. That account has exactly ten cases. The two finished cases were removed after their
JSON audits were saved; the runner did not delete existing fixtures or interrupted cases.
Future stages need room for synthetic cases and must preserve the original interruption audits.

The run used the production server operations directly, not the deployed HTTP/browser journey.
The report includes only two finished runs in metric denominators; interrupted checks are N/A.
The 51/51 literal quote checks and 3/3 deterministic local linter probes must not be presented
as successful end-to-end evaluation. T12 is incomplete. Stage two has not been started.

After evaluation, the owner must run the entire `eval/restore-caps.sql` in SQL Editor. It sets
15 per user / 15 globally and retains the day's usage. Until then, the database caps remain
temporarily elevated; the evaluation checkpoint enforces the approved total across both stages.

After saving the report, `npm run check` passed both server type-checks, 375 server/database
tests, 90 Angular tests and the production build. These code checks do not turn the failed live
runs into successful evaluations.
