# Stage-one failure investigation and rerun preparation

Owner requested these fixes on 3 October 2026, without approving stage two. The next live batch
is a separate stage-one attempt with a hard 40-logical-call limit. Its results must not replace
or reclassify the original failed observations.

## Causes found in the saved audit

1. The false clean-case ID came from **E01 / invoice.pdf**, read by Qwen. Its exact candidate
   value and quote were `FICTIONAL TEST DOCUMENT - NO REAL CUSTOMER OR TRANSACTION`. That footer
   really exists in the PDF, so the literal quote check passed. The old ID normaliser accepted
   any nonempty string of at most 160 characters, including sentences. This was a field
   misclassification followed by overly permissive normalisation, not a character misread or
   explicit-absence conflict. All actual IDs in E01/E02/E03 are `MM260901`. A regression uses the
   exact footer and retains the real ID candidate while excluding that malformed candidate.
   ID punctuation and leading zeroes, and the measured reference value `None`, remain tested.
2. `refund_received` was **Missing in clean-overdue**, not true instead of false. E04 /
   customer-status.pdf failed extraction validation: the diagnostic identifies `facts[2].quote`
   as an empty string. The strict whole-response parse discarded every candidate, so no receipt
   evidence reached the fact sheet. The original raw response was not retained; the field at
   index two and the content of the other candidates cannot be recovered. The reader now validates
   candidates separately, retains properly quoted candidates and records rejected counts. An
   all-invalid response still fails. The regression retains `Refund not received.` alongside an
   independently invalid candidate with the exact observed empty-quote error at index two. It is
   a scripted reconstruction, not a claim about an unavailable original response.
3. In conflicting-amounts, the recorded choices were get-next-step, reread E02, get-next-step,
   reread E02, get-next-step, reread E02, reread E02, a failed choice, and two get-next-step choices.
   The source amount conflict stayed open; the model never selected ask-user. No recorded output
   reveals the model's internal reason. The input exposed the conflict's null value but omitted
   its source alternatives and action history, and code permitted repeated unchanged steps.
   The context now exposes checked source alternatives. Active tool schemas favour ask-user and
   reread for an open conflict. A persisted fact fingerprint and action signatures recognise one
   repeat, including rephrased rereads of the same document. Code then executes one ask-user tool
   with actual source alternatives, without counting the repeated selection as progress. Without
   an open conflict, it stops with a clear message. A changed semantic fact sheet resets history.
   Scripted tests cover the original reread wording and an unchanged repeated get-next-step.
4. The ten-case account limit filled because interrupted evaluation cases were retained.
   Every saved result now permits scoped cleanup of its own storage paths and rows, including
   interruptions. Audit saving precedes deletion; owner, exact title and every path are checked.
   The old four retained cases were cleaned with zero model calls. Hosted read-only checking
   confirmed six earlier fixtures remain, zero evaluation cases remain, and usage stays at 36.

## Pacing and request size

Owner supplied Groq limits: **30 RPM / 8,000 TPM**. The local runner spaces Groq windows by at
least 61 seconds and conservatively reserves UTF-8 text bytes plus output allowance and framing
margin. Image bytes are not treated as text tokens: an image request reserves a full window,
with provider quota enforcing its actual pixel-token cost. No HTTP handler or provider-fallback
attempt sleeps. A local pacing refusal is an application error and cannot write provider cooldowns.
Between advances, the runner reads the signed cooldown table and waits for a non-daily model to
become usable. A provider-cooldown stop requires **every suitable model** to be daily-blocked.
Budget, validation, storage and network failures remain honest failures; they are not quota successes.

Offline serialization through the actual Groq SDK measured one amount-conflict choice request:

| Tool configuration | Tool-schema UTF-8 bytes | Input-payload UTF-8 bytes |
|---|---|---|
| All eight schemas | 3,036 | 7,054 |
| Two relevant schemas | 1,127 | 5,145 |

These are **byte measurements, not token counts**. The chooser output allowance also fell from
2,500 to 600 tokens. The rerun transport records actual Groq `prompt_tokens` and completion usage,
including tool-choice requests, plus only safe rate-limit headers. No request body, key or token
is retained. Details are in `eval/tool-request-size.json`; the measurement script makes no network
or database calls. Groq documents token-minute headers and cooldown hints at
https://console.groq.com/docs/rate-limits.

## Rerun gate

The full preparation check passed both server type-checks, 394 server/database tests, 90 Angular
tests and the production build. These are fake-provider and deterministic checks, not live results.

The owner restored caps to 15/15. After the full code check passes, the owner applies
`eval/raise-rerun-caps.sql`, which grants only forty more logical charges on the India day without
resetting usage. The live command selects repetition one only and uses a separate checkpoint:

```sh
npx tsx eval/run-eval.ts --live --batch rerun-stage-one --session-file tmp/t2/session.json --max-logical-calls 40 --max-provider-attempts 120 --repetitions 1 --continue-on-stop
```

It saves to `eval/results/rerun-stage-one/` and `eval/rerun-stage-one-report.md`; original results
remain untouched. A named-rerun CLI guard rejects another repetition or a limit above forty.
Forty calls cannot complete every production journey: there are 29 document reads and at least
one investigating choice per each of 12 cases, before image quote checks, plans or drafts.
Any budget-limited cases must remain explicitly incomplete. Stage two has not been approved.

Restore 15/15 with `eval/restore-caps.sql` after the rerun stops.

## Live rerun observations and an offline pause

The owner confirmed the forty-call SQL on 3 October. The pass started on commit `49d8a74`,
crossing into 4 October India time. The first tool-choice response measured 1,827 prompt tokens
and 15 completion tokens (600 output allowance), rather than inferring tokens from byte size.
The clean ID is now `MM260901` with document status. The clean case still failed: Qwen marked
E04 unreadable with zero facts, independently of the original empty-quote validation error.
The amount-conflict case also failed: E02 returned readable with zero facts, so the initial
conflict and due date were missing. These original rerun failures stay in the saved results.

The clean case made differently worded guidance searches returning zero rows, then its identical
repeated source-ID query was stopped by the new repeat guard. Investigation confirmed that the
stored full-text index contains only `title || body`, not source IDs. Websearch combines terms
as required terms, and literal IDs are not reliable searches of those words. Retrieval now uses
an exact ID lookup for source IDs and fetches missing code-required source IDs when a broad
search fails. The checked-guidance policy and plan validation remain intact, including step zero.
An initial assumption that step zero needed no checked guidance was corrected after reading the
validator and seed; no change allowing unchecked plans was made.

The runner was paused during a pacing wait at 22 logical calls / 23 SDK attempts: clean 14/15,
conflicting amounts 5/5, and two reads plus one choice for the not-yet-due case. Its two finished audits and their
case cleanup are preserved. After fake-provider checks, it resumes that existing checkpoint
with eighteen logical calls remaining; neither completed case is retried. The not-yet-due case
therefore has reads and its first choice from `49d8a74`, with later investigation from `61d214b`.
Active runner seconds include pacing but exclude this offline pause.

## Final capped result

The pass ended on 4 October with **40 logical charges / 41 SDK attempts**. It did not complete
all twelve cases: five finished, the sixth stopped on the local budget, and six never started.
No repetition two or three was attempted. See `eval/rerun-stage-one-report.md` and its six JSON
audits; the original `eval/report.md` and original result files are unchanged.

| Case | Result | Logical / SDK attempts | Code used |
|---|---|---|---|
| clean-overdue | Failed: repeated empty guidance search; E04 unreadable | 14 / 15 | 49d8a74 |
| conflicting-amounts | Wrong missing-date pause; E02 readable but zero facts | 5 / 5 | 49d8a74 |
| not-yet-due | Correct step zero, no pause; receipt fact still Missing | 7 / 7 | Mixed as documented above |
| already-complained | Wrong missing-date pause; E01/E02 unreadable | 5 / 5 | 61d214b |
| out-of-scope | Correct out-of-scope outcome, no pause | 5 / 5 | 61d214b |
| missing-order-id | Budget interruption after one targeted reread | 4 / 4 | 61d214b |
| unreadable-image, injected-instruction, mixed-amount-formats, two-refund-dates, written-refusal, bank-reference | Not started: no remaining budget | 0 / 0 | No live run |

Google made three attempts with two routed responses: Gemini 3.8 Flash read the support image
after 3.6 failed, then Gemini 3.6 checked the image quotes. Groq made thirty-eight attempts and
returned thirty-eight routed responses. There was one fallback response. Every metered Groq
HTTP response was 200: no RPM/TPM failure or account-limit interruption occurred. Daily-only
cooldown stopping and waiting after a transient all-model cooldown remain fake-provider tested,
not live exercised in this pass. Empty extraction and unreadable responses remain measured
quality failures; no explanation of the model's internal reason is asserted.

Twenty-two actual tool-choice requests measured **1,304–1,827 prompt tokens**. The first was
1,827 prompt / 15 output tokens. Total Groq reported usage was 37,177 prompt / 4,025 completion
tokens across the pass, not in a single minute. Active runner time was 2,310.65 seconds including
pacing, excluding the offline pause. Two of five completed outcomes were correct, three of five
pause sets matched, and the initial receipt field was correct in two of five finished cases.
All 54 extracted document quotes passed literal checking; this does not measure extraction
coverage or establish that each quote belongs to the model-selected field. No live draft or
injection evaluation completed. T12 acceptance remains incomplete.

Hosted cleanup verification used only the caller: zero rows remained for old/new evaluation IDs
in all nine case tables, and twelve storage prefixes contained zero entries. Six earlier fixtures
remain; zero evaluation cases remain. India-day usage was 46 on 3 October and 30 on 4 October;
subtracting the pre-pass 36 gives exactly forty charges. Counters were not reset. The owner was
asked to restore 15/15 using `eval/restore-caps.sql` and confirmed "Caps restored" on 4 October. The final retrieval
fix check passed 397 server/database tests, 90 Angular tests, both type-checks and the build.
