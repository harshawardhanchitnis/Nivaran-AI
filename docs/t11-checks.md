# T11 local checks — 2 October 2026

These checks use a synthetic, caller-owned hosted fixture and scripted draft prose. They are
implementation checks, not a real complaint or results from the full model evaluation.

- The owner confirmed applying `0010_case_outcomes.sql`. The 52 database policy/seed tests cover
  ownership, visitor denial, request replay, pending refusal-file ownership, active work claims,
  saved complaint preservation, outcome statements, resolved cases and waiting-plan draft denial.
- The four-choice outcome panel reuses the existing workspace and upload component. Refusal
  requires consent and one valid reply file; service tests cover limits, duplicate detection,
  appending evidence labels and cleaning up only the new file after a failed row save.
- Code recomputes the ladder after an outcome. Unit tests cover no reply, acknowledgement,
  resolution, unreadable/read refusal replies, missing dates and unavailable checked guidance.
  Waiting plans do not call the draft provider. API tests check authentication, validated input,
  server-supplied India date and recoverable messages.
- For the existing T8/T9/T10 fixture, the browser corrected the sent date to 25 September 2026.
  This was a synthetic test correction. The original T10 calendar download still contains its
  earlier 1 October sent-date calculation and remains available for the deferred calendar preview.
- Recording no reply moved the case to step two with acknowledgement due 27 September and
  resolution due 25 October. The receipt-date caveat and checked guidance were visible.
  After caller-scoped approval, an injected scripted generator saved a helpline-shaped draft
  with the actual model label `scripted-test-no-provider`. The code inserted dates from the same
  facts. Reopening the complaint and printable pack restored the saved text without generation.
- The 360 px helpline pack had document width 345 px, zero axe violations, zero incomplete
  checks and zero console warnings/errors. The no-reply plan also passed the phone checks.
  Screenshots and row audits are in ignored `tmp/t11/`.
- Recording acknowledgement showed a waiting plan with no new-letter action. Recording refund
  arrived resolved the case. The hosted audit retained all three earlier draft versions.
- Provider calls: **zero**. One scripted draft generation was used. The hosted daily counter
  remained at fifteen. Live refusal reading and live helpline prose remain unverified.

Full check: both server type-checks, 351 server/database tests, 90 Angular tests and production
build. The owner's calendar preview and the deployed journey remain pending.
