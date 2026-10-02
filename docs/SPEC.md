# Nivaran AI: product specification

This is the agreed final scope for WCC Launchpad 30, Track 1 (Agentic AI). It is the source of truth
for what to build. `docs/BUILD_PLAN.md` says in what order; `AGENTS.md` says how.

## 1. Product

Nivaran handles one situation end to end: **an online order where a refund is owed and has not
arrived.**

In scope, any one of:

- a prepaid order was cancelled;
- a return was accepted or picked up;
- the merchant confirmed a refund in writing.

Everything else is out of scope. The app says so plainly and points to the National Consumer
Helpline (1915). Out of scope explicitly includes bank or UPI transfer disputes and disputes about
whether a refund is owed at all.

The user uploads their order and refund correspondence. Nivaran builds a source-linked fact sheet,
asks only about gaps and contradictions, tells the user the right next step and its dates, and
prepares a complaint pack that the user reviews, approves and sends themselves.

The pitch line: *we deliberately solved one high-frequency consumer grievance end to end.*

## 2. Scope

### Journey 1: must be flawless (deployed by hour 16)

1. Anonymous sign-in, five sample cases, and a privacy notice with consent before any upload.
2. Upload of up to 6 files (PNG, JPG, PDF; 5 MB each). Must work at 360 px width, from a phone.
3. Every document is read into candidate facts, each with page and verbatim quote. Unreadable
   files are flagged and a better copy is requested.
4. Fact sheet with five statuses. Tapping a fact opens its source document, page and quote.
5. Investigation with model-chosen steps, one-tap questions, and a visible activity log of the
   real steps taken.
6. Plan panel: ladder step, reasons with links to the rule, and a timeline showing today and each
   deadline.
7. Approval, then the complaint. Each inserted value carries its evidence label, such as `[E02]`.
8. Linter on the model's draft and on the user's edits: any amount, date or ID that is not in the
   fact sheet is flagged, with the option to keep it as "Your statement". It flags; it does not block.
9. Pack: complaint, timeline, evidence index. Print to PDF and copy text.
10. Delete my case: removes the files and every row.

### Journey 2: the second act (hours 16–19)

11. "Mark as sent" with a date. The app shows the acknowledge-by and resolve-by dates and offers
    them as a calendar file (`.ics`, generated in the browser).
12. "What happened?" with four outcomes: refunded, acknowledged only, no reply, refused (upload
    the reply). The ladder recomputes and the helpline pack is prepared from the same facts.

If the team is behind at hour 16, skip Journey 2 and go straight to Proof.

### Proof (hours 19–23)

13. Evaluation set of 12 synthetic cases, each run three times, with results in the README.
14. Unit tests for the ladder and the linter, including seeded fake values.
15. One evaluation case hides an instruction inside a document; the agent must ignore it.
16. Saved runs for the sample cases (viewable with no model calls, clearly labelled as saved), plus
    per-user and global daily caps on model calls.

### Stretch, in this order

Hindi complaint output; quote highlighting inside the source; hand-checked grievance officer
contacts for five large merchants; evidence ZIP.

### Not building

Filing or sending anything; scheduled reminders; bank or UPI disputes; disputes over whether a
refund is owed; compensation estimates; a graph view; guessing merchant contact details;
pseudonymisation of documents.

## 3. Facts

Statuses and field names live in `shared/facts.ts`. Do not add a sixth status.

| Status | Meaning |
|---|---|
| Stated in document | A document says so, and the quote was found in that document. |
| Your statement | The user said so. No document supports it. |
| Conflicting | Two sources give different values. The user decides. |
| Missing | Needed, and not found anywhere. |
| Needs your check | The model read it, but the quote could not be confirmed in the source. |

Wording rule: a document is evidence of what the document says, not proof that the event
happened. Never label a fact "verified" or "proven".

No percentages anywhere: no "confidence 87%", no "completeness 92%".

## 4. Escalation ladder

Code decides the step. The model only explains it. The refund ladder lives in its own definition
file (`server/ladder/refund-not-received.ts`), separate from the engine (`server/ladder/engine.ts`),
so another complaint type can be added later as another file.

| Step | When | What Nivaran prepares |
|---|---|---|
| 0. Wait | The merchant's promised refund date has not passed | Nothing to send. Shows the date and offers the calendar file. |
| 1. Grievance officer | Refund overdue and no written complaint sent yet | Complaint asking for the refund, or for its bank reference number. |
| 2. National Consumer Helpline | No acknowledgement 48 hours after sending, or no resolution one month after sending, or a written refusal | Grievance text shaped to the helpline form, plus the evidence index. |
| 3. Consumer Commission (e-Jagriti) | The helpline does not resolve it | Information only. Nivaran prepares nothing. |

Decision rules, evaluated in this order. `today` is the current date in India (Asia/Kolkata) and
must be injectable for tests.

1. `refund_received` is true: the case is resolved. No step.
2. `refund_due_date` is unknown: no decision. The agent must ask for it. If the user states that no
   date was ever given, use the cancellation or return date plus 7 calendar days, and show that in
   the plan as *Nivaran's working assumption, not a rule*.
3. `today` is on or before `refund_due_date`: step 0.
4. `refund_reference` is present and the merchant says the refund was processed: bank-side delay.
   The plan tells the user to take the reference number to their bank and stops. Not a ladder step.
5. `complaint_sent_date` is unknown: step 1.
6. `complaint_refused` is true: step 2.
7. Not acknowledged and more than 2 days have passed since `complaint_sent_date`: step 2.
8. More than one calendar month has passed since `complaint_sent_date`: step 2.
9. Otherwise: still step 1, waiting. Show acknowledge-by and resolve-by dates.

Date arithmetic:

- "N working days" skips Saturdays and Sundays. Public holidays are not handled; say so.
- "One month" is a calendar month from the date sent.
- The model extracts the phrase (for example "within 7 working days") as a quote plus
  `{ n: 7, unit: "working_days" }`. Code computes the date.

Basis (each must exist as a hand-checked row in `guidance`, with source link and date checked):

- Consumer Protection (E-Commerce) Rules, 2020, rule 4(4): grievance officer and published contact
  details.
- Rule 4(5): acknowledge within 48 hours, redress within one month.
- Rule 4(10): accepted refunds paid within a reasonable period or as prescribed.
- National Consumer Helpline: pre-litigation, phone 1915, target of up to 30 days, then the
  Consumer Commissions.

Wording rules for the app: this order is recommended practice, not a legal requirement, and Nivaran
is not legal advice. The plan screen says both.

## 5. Agent design

### What is fixed in code

Reading each document once; normalising amounts and dates; detecting conflicts; the ladder; all
date arithmetic; inserting values into drafts; the linter; usage limits.

### What the model decides

In the investigating phase, the model chooses the next tool. Maximum 10 model-chosen steps per run
(`MAX_AGENT_STEPS`).

| Tool | Effect |
|---|---|
| `reread_document(document_id, question)` | A targeted second look for one missing field, before bothering the user. |
| `ask_user(field, question, options)` | Creates a question and pauses the run. |
| `request_document(kind, reason)` | Asks for a missing or better document and pauses the run. |
| `record_user_statement(field, value)` | Stores something the user said, with status "Your statement". |
| `search_guidance(query)` | Full-text search over the hand-checked guidance rows. |
| `get_next_step()` | Runs the coded ladder on the current fact sheet. Returns step, reasons and dates. |
| `mark_out_of_scope(reason)` | Ends the run. |
| `propose_plan(summary, guidance_ids)` | Ends the investigation and waits for approval. |

Every tool input is validated with Zod. An invalid call is recorded as an error event and counts
as a step.

### Checks the model cannot skip

- **PDF quotes** are matched in code against the PDF's text layer (whitespace-normalised).
- **Image quotes** have no text layer, so one second model pass confirms all image quotes. This is
  weaker than the PDF check; failures become "Needs your check".
- **Draft values** are inserted by code from the fact sheet (see section 7).
- **Usage limits**: the server calls the database function `charge_model_call()` before every model
  call and stops with a clear message when it returns `allowed: false`.

### Low blast radius

No tool sends, pays, files or deletes. Documents are untrusted input: the reading call has no
tools, and the tool-using loop sees only the structured fact sheet, never raw document text as
instructions.

### Run lifecycle

`reading` (one document per call) → `investigating` (one model call and one tool per call) →
`waiting_for_user` when a question is open → `plan_ready` → after approval, drafting.
Terminal states: `completed`, `out_of_scope`, `failed`.

One step per HTTP request. The browser calls `advance` while the run status is `running`. Run
state lives in Postgres, so a run survives a closed tab and resumes later. This is also what makes
Journey 2 work without a scheduler.

### API contract

| Endpoint | Body | Returns |
|---|---|---|
| `POST /api/agent/start` | `{ caseId }` | `{ run }`. Returns the active run if one exists. |
| `POST /api/agent/advance` | `{ runId, expectedTurn }` | `{ run, events, question?, plan?, retryAfterMs? }` |
| `POST /api/agent/draft` | `{ planId }` | `{ draft }` |

`advance` must be idempotent: it updates `agent_runs` with
`... where id = :runId and turn = :expectedTurn and status = 'running'` and treats zero updated
rows as a stale call (HTTP 409, returning the current run). `events` are the rows added by this
call. When the provider is rate-limited, answer 200 with `retryAfterMs` and leave the turn
unchanged; the browser waits and shows "waiting for model quota".

Answering a question and approving a plan are direct Supabase writes from the browser
(`questions.answer`, `plans.approved_at`), followed by `advance` or `draft`.

## 6. Reading documents

One schema-constrained model call per document, with no tools. Output:

- `doc_type`: invoice, order_confirmation, cancellation, return_confirmation, refund_message,
  support_chat, complaint_sent, merchant_reply, other.
- `readable`: false when the image is too blurred or cropped to read.
- `facts[]`: `{ field, value_text, quote, page }`, where `field` is one of `FACT_FIELDS` and
  `quote` is copied character for character from the document.

Images and PDFs are sent to the model directly. Do not use browser OCR as the reader.

## 7. Drafting and the linter

The model never types an amount, a date or an ID. It writes placeholders:

- `{{fact:<field>}}` for a fact sheet value, for example `{{fact:refund_amount}}`;
- `{{date:<name>}}` for a date computed by the ladder, for example `{{date:resolve_by}}`;
- `{{today}}`;
- `{{you:name}}`, `{{you:contact}}`, `{{you:address}}` for the user's own details.

Code renders the draft:

- `fact` and `date` placeholders become the formatted value plus its evidence label, for example
  `₹9,999 [E02]`. User statements are labelled `[your statement]`.
- `you` placeholders are filled **in the browser** from what the user types. Those details are
  never sent to the model or stored on the server.
- An unknown placeholder rejects the draft. Regenerate once, then fail with a clear message.

The linter runs on the rendered text, ignoring the spans code inserted, and again on every user
edit. It flags any amount (₹, Rs, INR or a bare number of three or more digits), date, or ID-like
token (six or more characters containing a digit) that does not match a fact sheet value after
normalisation. A flag offers "keep as Your statement" or "remove".

Claim it accurately: *every amount, date and ID is checked against the fact sheet.* Do not claim
the draft "cannot" contain unsupported statements; prose claims are not checked.

## 8. Data

Tables, row-level security and storage rules are in `supabase/migrations/0001_init.sql`; row
types are in `shared/database.ts`. Rules:

- Every row belongs to one user. Row-level security is on for every table.
- Vercel Functions act with the caller's own token. There is no service-role or secret key.
- `agent_events` is append-only through the API.
- `guidance`, `app_settings` and the usage counters cannot be written through the API.
- Evidence files live in the private `evidence` bucket under `<user_id>/<case_id>/...`.

Known trade-off, stated honestly: because functions act as the user, a user could write rows into
their own log through the API. They cannot touch anyone else's data or the usage counters.

## 9. Privacy and trust

The notice shown before the first upload must say, in plain words:

- Your documents are sent to Google's Gemini model to be read.
- On the free tier Google may use that content to improve its products.
- Hide card numbers and anything you do not want to share before uploading.
- You can delete your case, files and records at any time.
- Nivaran never sends or files anything. You review and send the complaint yourself.

The public demo uses synthetic documents with fictional merchant names.

## 10. Evaluation

Five sample cases, one per path: clean and overdue; conflicting amounts; not yet due; already
complained with no reply; out of scope. Seven more: missing order ID; unreadable image; injected
instruction; mixed amount formats; two refund dates; written refusal; bank reference present.

Each case has expected facts, an expected ladder step and expected pause decisions. Run each three
times and report in the README:

- facts correct, per field;
- quote checks passed;
- correct ladder step and correct pause decisions;
- same result across the three runs;
- seeded linter errors caught;
- model calls and seconds per run.

Report the numbers as measured, including the failures. Do not use invented scores anywhere.

## 11. The two-minute demo

1. The problem, with one number from the team's own interviews.
2. Upload four documents from a phone.
3. The agent finds two amounts that disagree and asks one question.
4. Tap a fact to show its source and quote.
5. The plan, with the acknowledge-by and resolve-by dates; approve it.
6. Type a fake transaction ID into the draft and show it flagged.
7. Open the "already complained" case and show it move to the helpline step.
8. Close on the evaluation numbers.

## 12. Judging criteria this maps to

| Criterion | Points | Where Nivaran earns it |
|---|---|---|
| Strength of the core solution | 24 | One journey from scattered documents to a usable pack, then a second act. |
| Technical depth and reliability | 24 | Resumable runs, code-level checks, tested policies, measured evaluation. |
| User insight and problem evidence | 15 | The team's interviews and survey, plus public helpline data. |
| Originality and differentiation | 15 | Source-linked facts, placeholders instead of typed values, honest statuses. |
| Real-world usability | 12 | Phone first, one-tap questions, no sign-up, no walkthrough needed. |
| Responsible design and trust | 10 | Approval gates, privacy notice, delete, low blast radius, no legal overclaiming. |
