# Bounded production journey, 4 October 2026

Production alias: https://nivaran-ai-green.vercel.app. Tested revision a3867f9 after the owner
redeployed with ENABLE_LLM_CHECK=false. This is one deployment acceptance journey, not another
evaluation pass. The corpus measurements and their revision remain unchanged.

**Result: partial pass; full deployment acceptance has not passed.** The grievance journey,
editing, copy, source preview, sent/outcome persistence and deletion worked. The helpline plan
was correct, but both draft templates failed validation. A My cases date-display bug was found
and fixed locally; the fix still needs publication. Native print-dialog confirmation remains
an owner check.

## Calls and actual outputs

The owner applied deploy/raise-smoke-caps.sql, retaining usage and granting fifteen additional
global logical calls on the India date. The new deployment-origin caller started with zero.
Its final counter is **13**, leaving two unused. No more model calls were made after the failed
helpline draft. Provider attempts were not instrumented in this browser check; do not equate
the logical counter with a measured provider-attempt count.

| Operation | Logical calls | Retained answering model / result |
|---|---|---|
| Vision diagnostic | 1 | gemini-3.6-flash: “ok”, 2,522 ms |
| Text diagnostic | 1 | qwen/qwen3.8-27b: “ok”, 599 ms |
| Four PDF reads | 4 | gemini-3.5-flash-lite for E01–E04; 5, 7, 3 and 1 extracted facts respectively |
| Investigation | 4 | qwen/qwen3.8-27b: ask_user, get_next_step, search_guidance, propose_plan |
| Grievance draft | 1 | qwen/qwen3.8-27b; saved initial version, then a reviewed edit |
| Helpline draft and repair | 2 | Both rejected with draft_template_invalid. Answering models and exact invalidity were not retained. |
| Total | 13 | No invented result or replacement draft |

All six infrastructure checks passed in bom1 with six guidance rows. After redeployment,
the diagnostic endpoint returned 403 / llm_check_disabled before authentication or charging.

## What the real browser journey checked

- At 360 px, consent and Continue uploaded the four existing fictional PDFs: conflicting-amounts
  invoice.pdf, refund.pdf, second-refund.pdf, and clean-overdue customer-status.pdf.
- All four read as PDFs with text layers. All sixteen extracted document quotes matched their
  text layers. Order MM260901 remained consistent. The refund message supplied “refund not
  received”, normalised to false; the customer-status read supplied only the ID. This single
  journey is not evidence that extraction is complete generally.
- The actual question offered INR 9,999.00 and INR 8,999.00. Leaving for My cases and reopening
  restored the question. Choosing INR 9,999.00 saved Your statement, preserving both source amounts.
- An uploaded order-ID source displayed its actual PDF page and quote. Code chose grievance
  step one using 4 October as today; checked rule 4(4) and its checked date appeared.
- Approval generated a real grievance draft. FAKE123456 added in the real editor produced one
  flag. It was removed. Review also corrected the original model's “promised a refund by
  14 September” to “on”: 14 September was the promise date, and 24 September the due date.
  This is a prose error that the value linter does not catch. The plan's model summary was also
  unhelpfully phrased “Determine the escalation path in code”; the coded reason explained the step.
- The saved edit reopened in the pack and copied with MM260901, without the fake ID, and with
  the corrected promise wording. The pack included the timeline, four-document index and checked
  guidance. Browser print-to-PDF produced two visually inspected pages without clipped text or
  editing controls. Clicking native Print / save PDF blocked automation; reopening recovered
  the saved case. The native dialog is not claimed as checked.
- Recording the synthetic sent date 1 October produced acknowledge-by 3 October and resolve-by
  1 November, with the receipt-date caveat. No actual complaint was sent. Recording no reply
  recomputed helpline step two without a model call. Rule 4(5), NCH, checked dates and the caveat
  displayed. Approval spent two calls on invalid templates; no helpline draft was saved.
- Cancel deletion retained the case. Confirming deletion removed the four private objects and
  all nine tables' rows for this exact disposable case. The empty list announced success and
  focused its heading. The usage counter stayed at thirteen.

## Found display bug

My cases displayed “Resolution due: 31 Oct 2026” although the stored date and case timeline
were 2026-11-01. A standalone Angular DatePipe reproduction in Asia/Kolkata confirmed the cause:
a date-only string is parsed at local midnight, then explicit UTC formatting moves it into the
previous date. My cases now adds T00:00:00Z before formatting. Regression checks cover the exact
2026-11-01 value in India, Los Angeles and UTC. Database dates and ladder arithmetic were correct.
The merchant subtitle also said “Merchant not read yet”: list cards use the separate case-row
merchant field, which stayed empty despite the fact sheet containing Meridian Mart. This subtitle
limitation remains; no merchant fact was missing from the workspace.

## Phone and access checks

Visited production status, consent/upload, source sheet, conflict, both plans, editor, pack and
empty case list had no horizontal overflow at 360 px and no axe A/AA violations. Source-sheet
focus and gradient checks were incomplete in axe; earlier local manual checks remain separately
documented. All five Saved runs opened without model calls, and historical failure warnings stayed
visible. No application console warnings/errors were captured; the two native-print automation
timeouts are reported above, not presented as app console errors.

The owner was asked to restore 15/15 caps immediately after stopping. Restoration is pending
confirmation. No additional evaluation or live retry is authorised by this report. Remaining
human checks: native print and calendar preview, independent phone users, research, demo recording
and submission. The failed helpline draft must remain disclosed.
