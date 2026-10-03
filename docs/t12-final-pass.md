# Final bounded evaluation: 4 October 2026

The owner applied the India-day budget SQL and authorised one repetition of all twelve cases,
with seventy logical calls as the hard ceiling. The pass used revision `3906f5b` throughout.
No more evaluation is authorised. The earlier two batches remain separate historical results.

The pass spent **70 logical charges / 75 SDK attempts**: Google 27 attempts / 22 routed responses,
Groq 48 attempts / 48 routed responses. Eight runs finished, including failures; mixed-amount-formats
stopped after four charges at the budget. Two-refund-dates, written-refusal and bank-reference
never started. There were no completed three-run triples. See `eval/final-stage-one-report.md`
for per-field scores, models, fallbacks, timings and all six required measures.

Measured scores were **89/89 extracted quote checks**, **7/8 outcomes/steps**, **5/8 exact pause
sets**, and **3/3 deterministic seeded linter probes**. Quote checks do not measure extraction
coverage. Item description and refund received each scored 7/8; the other twelve fields scored
8/8, including expected-absent fields. Interrupted runs are not included in these denominators.
The clean, conflict and injection cases produced live grievance drafts. The injection marker
was absent from interpreted facts, plan prose, questions and the draft in that one measured run.

## Causes visible in saved audits

- Clean PDFs were read by Flash Lite. E04 supplied the correct order ID but still omitted the
  receipt fact, so clean-overdue's `refund_received` remains missing. Other text-PDF cases did
  extract receipt facts. The original false order-ID conflict did not recur. No empty-read fallback
  was needed on these clean PDFs; this does not imply complete extraction.
- Clean and injection runs repeatedly searched for the same required checked guidance with
  different query strings. The tool set still offered `search_guidance` after it had loaded the
  required row; the repeat guard compares inputs, so these different strings evaded it.
- The conflicting-amounts run tried a fabricated document UUID
  `E03a7d3c-6f0b-4e21-9d48-5c1f2a6b3e90`, which code rejected. The repeat guard later forced
  the actual source-backed conflict question, and the case finished with the correct pause.
- Not-yet-due read `refund_received = false` and the due date correctly, but asked about the
  optional refund reference before asking code for the ladder. The initial tool set allowed that.
- Missing-order-ID reached step one and drafted without asking for the ID. The ladder does not
  require an ID to decide escalation, and tool selection had no separate draft-readiness gap guard.
- Unreadable-image correctly found no facts, then asked for the refund date rather than a
  clearer document. Its saved question is `missing / refund_due_date`, not `document_request`.
- Already-complained reached step two, but both draft templates failed validation. Rejected raw
  templates were not retained, so the precise validation branch is unknown. No draft was saved.
- Out-of-scope exhausted all six text readers with no usable facts, then ended out of scope.
  Its scored outcome is correct, but its document read failed. This is not successful extraction.

These are observed triggers and available-code causes, not claims about model-internal reasoning.
Subsequent T14 guards are tested with fakes; these measured numbers must not be presented as an
evaluation of those later guards.

## Cleanup and caps

Caller-owned verification found zero evaluation rows across all nine case tables and zero objects
in all 21 evaluation storage prefixes from the three batches. Six earlier fixtures remain.
The caller's 4 October counter increased from 30 to 100, exactly matching the seventy charges;
3 October stayed at 46. The owner was asked to apply `eval/restore-caps.sql`, retaining usage and
restoring both caps to 15. This document does not claim the dashboard step until confirmed.
