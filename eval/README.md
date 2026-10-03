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

Before a large live batch, obtain the owner's approval and have the owner temporarily raise the
logical-call caps in SQL Editor. Restore both caps to 15 after the batch. A suitable first budget
is **300 charged logical calls and 450 provider attempts** for 36 runs, estimated around **230–290
logical calls** if investigation takes three to five choices per ordinary case. This is an estimate, not a
result. The budget may stop the batch before all runs finish; fallback, rereading and draft repair
can increase consumption. Provider quota and model cooldowns still apply. After approval, the
owner runs `eval/raise-caps.sql` in Supabase SQL Editor. After the batch finishes or stops, the
owner runs `eval/restore-caps.sql`. These are dashboard configuration files, not schema migrations.

Keep a fresh anonymous session token in an ignored file shaped as `{"token":"…"}`. Never paste
the token or put it directly in arguments. From the repository root:

```sh
npx tsx eval/run-eval.ts --live --session-file tmp/t2/session.json --max-logical-calls 300 --max-provider-attempts 450 --cleanup-completed
```

The owner approved a staged batch on 3 October: stage one is exactly repetition 1 of each case.
Stop and report before repetitions 2 and 3; those require a further owner reply. Use:

```sh
npx tsx eval/run-eval.ts --live --session-file tmp/t2/session.json --max-logical-calls 300 --max-provider-attempts 450 --repetitions 1 --continue-on-stop --cleanup-completed
```

`--continue-on-stop` records an interruption and tries the next case once, without sleeping or
retrying the interrupted case. A local budget stop still ends the batch. After the owner approves
stage two, select `--repetitions 2,3` using the same checkpoint and total budgets; this preserves
interrupted first-stage observations. The 300 charges cover both providers, not 300 Gemini calls.
The dashboard budget SQL uses India dates, matching `charge_model_call()`. Reports distinguish
models that actually answered from attempted models and label fallback responses explicitly.

The cleanup flag removes **only completed synthetic cases created by this evaluation checkpoint**,
after saving their audit, with files first. Ownership, title and every path are checked. It never
deletes existing user cases. Without the flag, synthetic hosted cases remain for inspection.
Interrupted cases are retained for resuming. `--case clean-overdue` and `--rounds 1` allow a bounded
subset using the same batch budget.

Progress is in ignored `tmp/eval/checkpoint.json`; audit results are in `eval/results/`. Resume with
the same command, corpus, owner and budgets. A quota/cooldown/network stop ends the runner without
sleep or automatic retry. Refresh an expired session and resume later. Consumed calls remain in
the checkpoint and database. Each SDK attempt is written synchronously before invocation, so a
process crash cannot replenish its attempt budget. A crash just after the database accepts a
charge can still under-count local logical telemetry; compare it with the database daily counter
before resuming a crashed batch. The dashboard cap independently bounds global charges. Do not
silently increase budgets or reset usage.

`eval/report.md` contains all six required measures, including failures and interruption costs.
Only live observations of the current corpus are eligible. Empty results are explicitly pending.
The three local seeded-linter probes are labelled deterministic checks, not model accuracy.
