# T12 preparation — 2–3 October 2026

The evaluation implementation is prepared. The live acceptance check is **pending**, and T12 is
not complete until the thirty-six live runs and their measured report have been reviewed.

- Twelve authored synthetic cases cover the exact paths in SPEC section 10, with 29 documents.
  The generator, source text, expected facts, steps, pauses and simulated answers are committed.
- All 27 text PDFs were extracted with unpdf and each authored source line matched after
  whitespace normalisation. All 29 documents were rendered or opened for visual inspection;
  no clipping was found. The deliberately blurred image is unreadable.
- Expected steps were tested against the real ladder using authored values and specified answers.
  These are ground-truth consistency tests, not results from a model.
- Fake-operation tests cover fixed evaluation dates, initial facts captured before an answer,
  canonical choice selection, unexpected questions, resumed approved drafts, cooldown stops and
  refusing cleanup outside a checkpoint's owned case. Unit tests also cover empty reports,
  failed-agent scoring, unexpected pauses, repeatability and stale corpus exclusion.
- Request-local call instrumentation retains mandatory database charging, counts each SDK attempt,
  and saves attempt counts before invoking a provider. Local budget stops cannot create provider
  cooldowns. Conflicting dry/live CLI flags and missing budgets are rejected.
- `npx tsx eval/run-eval.ts --dry-run` validated the corpus and wrote the report, with **zero
  database calls and zero provider calls**. The report has **0/36 live runs** and no accuracy
  claims. Its separately labelled deterministic linter probes caught **3/3** seeded errors.
- The full check passed both server type-checks, 371 server/database tests, 90 Angular tests and
  the production build. No new database schema or provider settings are needed.

On 3 October the owner approved the budget and confirmed applying corrected India-date caps SQL.
Stage one runs repetition 1 of all twelve cases, then stops for a report and the owner's reply.
Stage two (repetitions 2 and 3) is not authorised until that reply. Both stages share the same
300-logical-call / 450-provider-attempt checkpoint budget. Actual answering models and fallback
responses are recorded separately from attempted models. An interrupted case is retained and
the runner can try the next case once without waiting or retrying it.

The original proposal was:
The proposed limit is 300 logical charges and 450 provider attempts, with an estimate of 230–290
logical calls. The runner can stop before all repetitions finish and resume after cooldown or
quota recovery without repeating saved work. Caps must return to 15/15 with
`eval/restore-caps.sql` when the batch finishes or stops. Neither SQL file resets usage counters.

This approval is required by the owner's handover, which says to estimate and wait before using
more than about thirty model calls in one go. Deployment and the owner's deferred calendar
preview remain separate pending checks.
