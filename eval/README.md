# Reproducible product evaluation

The twelve fictional cases in `cases/` match SPEC section 10. Each folder contains its documents,
their authored text, canonical expected facts, expected outcome/step, pauses, and predetermined
answers. Fields omitted from expected facts must remain Missing. `absent` accepts either Missing
or an explicitly absent reference; it never accepts a fabricated ID. The evaluation clock is fixed
to 2 October 2026 in India. Run timestamps record the actual execution date.

Rebuild documents with Python and one authoring dependency, `reportlab` (which depends on Pillow):

```sh
python -m pip install reportlab
python scripts/generate-eval-documents.py
npx tsx eval/run-eval.ts --dry-run
```

Generation makes no network calls. It writes deterministic PDFs and PNGs; changing any source or
document changes the corpus hash. The blurred image intentionally destroys readable characters.
All merchants, identifiers and transactions are fictional. Expected facts are not sent to models.

The live runner uses caller-owned Supabase clients, the production reader, quote checks,
investigation loop, atomic transactions, ladder and draft generator. Each operation corresponds to
one advance step. It measures initial facts before scripted answers. It answers only a matching
question and simulates approval only on the synthetic plans. This does not replace the deployed
phone/browser acceptance test.

The original stage one spent 36 logical calls and 44 provider attempts. Its failures are retained
in `results/` and `report.md`. The owner has **not approved stage two** and restored caps to 15/15.
The current authorised work is a separate stage-one rerun, repetition 1 only, capped at **40
logical calls**. Before starting it, the owner applies `eval/raise-rerun-caps.sql` in SQL Editor.
It adds forty to today's India-time usage without resetting counters. After the rerun finishes
or stops, the owner applies `eval/restore-caps.sql`. These are dashboard configuration files,
not schema migrations. `raise-caps.sql` belongs to the original 300-call approval; do not use it
for this rerun. Logical charges cover both providers, not just Gemini.

Keep a fresh anonymous session token in an ignored file shaped as `{"token":"…"}`. Never paste
the token or put it directly in arguments. From the repository root:

```sh
npx tsx eval/run-eval.ts --live --batch rerun-stage-one --session-file tmp/t2/session.json --max-logical-calls 40 --max-provider-attempts 120 --repetitions 1 --continue-on-stop
```

The named rerun rejects a logical limit above forty or a repetition other than one. The local
attempt ceiling of 120 also remains inside the original 450-attempt total. Forty calls may end
the pass before every case finishes: the corpus has 29 document reads before investigation,
image quote checks and drafting. Do not silently increase the budget or fill in missing results.

Every audited synthetic case is cleaned after its JSON result is saved, including interrupted
cases. Storage deletion precedes row deletion. Ownership, exact checkpoint title and every path
are checked; earlier fixtures and other user cases remain intact. The old optional
`--cleanup-completed` flag is accepted for command compatibility; cleanup is now automatic.
To clear retained cases from the original checkpoint after verifying their saved audits:

```sh
npx tsx eval/run-eval.ts --cleanup-saved --session-file tmp/t2/session.json
```

Groq limits supplied by the owner are 30 RPM and 8,000 TPM (`EVAL_GROQ_RPM` / `EVAL_GROQ_TPM`).
The local runner waits between advances, reserves text input bytes conservatively, and spaces
Groq windows by at least 61 seconds. Images reserve a full window because encoded image bytes
are not a text-token estimate. Production handlers and fallback attempts never sleep or retry
an SDK call. On transient provider cooldowns the runner reads the stored usable-after time and
waits. A provider cooldown ends a case only when every suitable model is daily-blocked. Other
budget, validation or network failures remain explicitly recorded failures.

`--continue-on-stop` tries the next case after saving an interruption. A local budget stop still
ends the batch. Named progress is in ignored `tmp/eval/rerun-stage-one.json`, results are in
`eval/results/rerun-stage-one/`, and the report is `eval/rerun-stage-one-report.md`. Resume with
the same command, corpus, owner and budgets. Saved, cleaned interruptions are historical
observations and are not retried on resume. An unaudited case remains hosted if fetching or
saving its audit fails; recover that audit before deletion. Refresh an expired session if needed.
Each SDK attempt is checkpointed before invocation. A crash just after a database charge can
still under-count local telemetry; compare it with the India-day database counter before resuming.

Reports include all six required measures, failures, interruption costs, actual answering models
and fallback labels. Groq response usage records actual prompt and output tokens; absent usage
is N/A. Offline serialization in `tool-request-size.json` measures bytes, not tokens. Only live
observations of the current corpus are eligible. Empty results are explicitly pending. The three
seeded-linter probes are deterministic checks, not model accuracy. See `docs/t12-fixes.md` for
the evidence behind the fixes and the remaining rerun gate.

## Final authorised pass (4 October)

The owner requested a separate Gemini-first text-PDF reading lineup and one final pass of all
12 cases. `LLM_PDF_TEXT_READING_LINEUP` defaults to Flash Lite, Flash 3.5, 3.6, 3.8, 3.7, then Qwen.
Tool choice and drafting keep their Qwen-first text lineup; vision is unchanged. A text-layer PDF
that returns unreadable or zero accepted facts tries each next reader once within the same
logical charge. Empty reads do not write provider-wide cooldowns. If none extract facts, reading
fails clearly; no facts are filled in. Fake-provider tests cover these paths.

After the owner applies `eval/raise-final-caps.sql` (70 more calls on the India date):

```sh
npx tsx eval/run-eval.ts --live --batch final-stage-one --session-file tmp/t2/session.json --max-logical-calls 70 --max-provider-attempts 350 --repetitions 1 --continue-on-stop
```

The final named batch rejects subsets, repetitions other than one, or more than 70 logical calls.
Its 350 SDK-attempt ceiling plus the earlier 85 attempts remains below the previous 450-attempt
ceiling. Results go to `eval/results/final-stage-one/` and `eval/final-stage-one-report.md`;
previous observations are retained. Apply `restore-caps.sql` immediately afterwards. The owner
has forbidden further evaluation after this pass and instructed proceeding through T13–T17,
even if the complete three-repeat T12 acceptance remains unmet.
