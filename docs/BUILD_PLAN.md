# Build plan

The clock: building starts **Sunday 4 October 2026, 10:00 IST**. Submissions close **Monday 5
October, 14:00 IST**. Aim to submit by 13:00. Hours below count from the start.

Work top to bottom. Do not start a task until the one before it passes its checks. After every
task: `npm run check` is green, then commit.

If you are behind at hour 16, skip Phase 4 and go to Phase 5.

---

## Phase 0: prove the skeleton (hours 0–2)

### T0.1 Supabase project (a human does this)

1. Create a Supabase project in the Mumbai region.
2. SQL Editor: run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql` with the guidance
   rows filled in.
3. Authentication > Sign In / Providers: allow anonymous sign-ins.
4. Copy `.env.example` to `.env.local` and fill in every value.

Check: `npm run dev`, open `http://localhost:4200/status`, press "Run checks". All six pass.
Then press "Test vision lineup" and "Test text lineup". Both answer (owner's routing update).

### T0.2 Deploy (a human does this)

1. Push the repository to GitHub and import it in Vercel (Hobby plan).
2. Add the variables from `.env.example` in Vercel > Settings > Environment Variables.
3. Deploy.

Check: `/status` on the deployed URL passes all six checks and both model tests, and reports
region `bom1`. Then set `ENABLE_LLM_CHECK=false` in Vercel and redeploy.

If the functions fail on Vercel while passing locally, read the function logs first. Likely causes,
in order: a relative import without `.js`; an environment variable missing; Vercel compiling with
the root `tsconfig.json` (the code is written to pass under it, so report the exact error). Last
resort: move the three endpoints to Supabase Edge Functions.

### T0.3 Set the usage limits

Read the free quota for the primary model in Google AI Studio. In the SQL Editor, set
`per_user_daily_model_calls` and `global_daily_model_calls` in `app_settings` so the global limit
stays below the daily quota.

---

## Phase 1: documents in, facts out (hours 2–7)

### T1 Create a case and upload documents

Build `features/case-new` and `core/cases.service.ts`.

- Privacy notice (SPEC section 9) with a consent checkbox; nothing uploads before consent.
- File picker and drag-and-drop; enforce `MAX_FILES_PER_CASE`, `MAX_FILE_BYTES`,
  `ALLOWED_MIME_TYPES` with clear messages.
- Create the `cases` row, upload each file to the `evidence` bucket at `evidencePath(...)`, insert
  a `documents` row per file with labels `E01`, `E02`, ... Navigate to `/cases/:caseId`.
- `features/my-cases`: list the user's cases; open one.

Checks: unit tests for the validation rules; a case with three files appears in Supabase with the
right paths; works at 360 px; an oversized or wrong-type file is refused with a plain message.

### T2 Read documents

Build `server/reader/read-document.ts`, `api/agent/start.ts`, `api/agent/advance.ts` (reading
phase only for now) and `server/usage.ts`.

- `chargeModelCall(supabase)` wraps the `charge_model_call()` function and throws
  `HttpError(429, 'quota_exhausted', ...)` when not allowed.
- `readDocument` downloads the file with the caller's client, sends it to the primary model with a
  Zod schema (SPEC section 6) and no tools, and returns `{ docType, readable, facts[] }`.
- `advance` in phase `reading`: read ONE pending document, insert `evidence_items`, set
  `documents.read_status`, append `agent_events`, bump `turn` with the compare-and-set update.
  When none are pending, set phase `investigating`.
- Provider errors (owner's 2 October routing update): immediately try the next task-lineup model
  on quota, rate-limit, demand or timeout errors. Use signed persistent cooldowns and charge once
  per logical call. If every candidate is unavailable, return `retryAfterMs` without bumping
  `turn`. Groq receives images or extracted text, never PDF file bytes. Fatal errors mark the file failed.

Checks: unit tests with a fake model for the happy path, an unreadable document, a stale
`expectedTurn` (409), and a refused charge (429). Manually: a real invoice PDF and a real
screenshot produce sensible `evidence_items`.

### T3 Fact sheet and source viewer

Build `features/case-workspace` with `fact-table`, `source-viewer` and the loop that calls
`advance` while the run is `running`.

- Fact table grouped by field, showing value, status label (`FACT_STATUS_LABELS`) and evidence
  label. Status is conveyed by text and icon, never colour alone.
- Tapping a fact opens the source: the image or PDF page (signed URL from Supabase Storage) with the
  quote shown beside it. On phones this is a bottom sheet.

Checks: with the sample documents, every fact opens the right document and quote; keyboard and
screen-reader usable; no horizontal scroll at 360 px.

---

## Phase 2: verification and the agent (hours 7–12)

### T4 Verification in code

Build `server/verify/normalise.ts`, `quote.ts`, `conflicts.ts` and `server/facts/build-fact-sheet.ts`.

- Amounts: `₹9,999.00`, `Rs. 9999`, `INR 9,999` all normalise to the same decimal.
- Dates: `14 Sep 2026`, `14/09/2026`, `2026-09-14`, `Sep 14, 2026` normalise to ISO; ambiguous
  `03/04/2026` is day-first (India). Durations: "5-7 working days" gives `{ n: 7, unit: 'working_days' }`.
- Quote check for PDFs: extract the text layer with `unpdf` and match after whitespace
  normalisation. Images: one second model pass for all image quotes (charge it).
- Fact sheet: one `case_facts` row per field. Same normalised value from several sources: status
  `document`. Different values: `conflict`. Quote not confirmed: `needs_check`. Required and absent:
  `missing`. User-provided: `user`.

Checks: table-driven unit tests for every normaliser and for the fact-sheet builder, including the
mixed-format amounts and two-dates cases from the evaluation list.

### T5 The investigating loop

Build `server/agent/loop.ts`, `prompts.ts` and one file per tool in `server/agent/tools/`.

- One logical model call per `advance`, tools as in SPEC section 5, each input validated with Zod.
- `ask_user` and `request_document` insert a `questions` row and set the run to
  `waiting_for_user`. `advance` on a waiting run with an answered question resumes it.
- Stop at `max_agent_steps` with a plain "could not finish" message and whatever facts exist.
- Every tool call and result is an `agent_events` row.

Checks: unit tests with a scripted fake model for: straight to plan; conflict then question then
resume; missing field then re-read then question; out of scope; step ceiling; invalid tool input.

### T6 Activity log and questions

Build `activity-log` and `question-card` in the workspace.

- The log shows the real events in plain words ("Read E02", "Found two different refund amounts",
  "Asked you which is right").
- Questions are answerable with one tap where options exist; free text only when needed.

Checks: the conflict sample case shows one question; answering it resumes the run without a reload.

---

## Phase 3: plan, approval, pack (hours 12–16)

### T7 The ladder

Build `server/ladder/engine.ts`, `server/ladder/refund-not-received.ts`, `server/ladder/dates.ts`.

- Pure function: `nextStep(facts, today)` returns `{ outcome, step, reasons[], dates{} }` following
  SPEC section 4 exactly, in order.
- `today` is always passed in. Use Asia/Kolkata for "today" at the call site.

Checks: table-driven unit tests covering every rule in SPEC section 4, working-day arithmetic
across a weekend, and month arithmetic at month ends (31 January plus one month).

### T8 Plan panel, timeline, approval

- `get_next_step` and `propose_plan` write a `plans` row. The panel shows the step
  (`LADDER_STEP_LABELS`), reasons with the guidance source link and "checked on" date, the two
  standing notes (not legal advice; recommended order), and a timeline with today and each deadline.
- Approve sets `plans.approved_at`. Edit and reject are possible. Nothing is drafted before approval.

Implementation uses migration `0007_plan_review.sql` and the caller-scoped `review_plan` transaction.
Request-change archives the proposal and asks what to change; reject stops investigation. Neither
review action makes a model call. Plans preserve code assumption notes and show that complaint
dates use the recorded sent date whereas rule 4(5) counts from receipt.

Checks: the "not yet due" sample shows step 0 and no draft; the overdue sample shows step 1 with
correct dates.

### T9 Draft, linter, pack

Build `server/draft/write-draft.ts`, `render.ts`, `server/verify/draft-lint.ts`,
`api/agent/draft.ts` and `features/case-pack`.

- Placeholders, rendering and linting exactly as SPEC section 7. The linter module is shared code
  with no server imports so the browser can run it on edits: put it in `shared/` if needed.
- The pack screen: complaint (editable), timeline, evidence index; the user's name and contact
  typed in the browser only; print stylesheet; "Copy text".

Checks: unit tests for the renderer (unknown placeholder rejected) and the linter (seeded fake
amount, date and ID each caught; values from the fact sheet not flagged; formats in words noted as
a known limit). Typing a fake ID into the draft flags it on screen.

**Then: deploy, run the whole journey on the deployed URL, and record a backup demo video.**

---

## Phase 4: the second act (hours 16–19)

### T10 Mark as sent

"Mark as sent" stores `plans.sent_on` and `complaint_sent_date` as a user statement. Show
acknowledge-by and resolve-by. "Add to calendar" downloads an `.ics` file built in the browser.

Checks: unit test for the `.ics` text; the file opens in a calendar app.

### T11 What happened?

Four outcomes: refunded (case resolved), acknowledged only, no reply, refused (upload the reply,
which is read like any document). The ladder recomputes; step 2 produces the helpline pack from the
same facts.

Checks: the "already complained" sample lands on step 2 with a helpline-shaped text.

---

## Phase 5: proof (hours 19–23)

### T12 Evaluation

Build `eval/cases/` (12 cases: documents, expected facts, expected step, expected pauses) and
`eval/run-eval.ts`, which runs each case three times against the real model and writes
`eval/report.md`.

Checks: the report contains the six measures in SPEC section 10, as measured. Paste the summary into
the README. Mind the usage limits: raise them for the run, then put them back.

### T13 Samples and saved runs

Five sample cases on the home page. Each opens a saved run (stored events and facts, no model
calls), labelled "Saved run". "Run it live" is offered while quota remains.

### T14 Failure handling

Quota exhausted (per user and global), rate-limited, unreadable file, network drop mid-run,
closed tab and return. Each shows a plain message and leaves the case usable.

### T15 Delete my case

Removes the storage objects, then the `cases` row (children cascade). Confirm first.

Checks: after deletion nothing remains in Storage or any table for that case.

---

## Phase 6: finish (hours 23–26, then submit)

- Two people who have not seen it complete a sample case on their own phones. Fix the top issues.
- README: problem and evidence, what it does, how it maps to the six criteria, architecture,
  evaluation numbers, how to run, disclosure pointer.
- `docs/ai-disclosure.md` and `docs/problem-evidence.md` complete and true.
- Final demo video following SPEC section 11.
- Submit by 13:00. Do not touch the deployment after submitting.
