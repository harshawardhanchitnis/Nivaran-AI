# Disclosure: prior work and AI tools

WCC Launchpad 30 requires earlier code and templates, and significant AI tools, to be disclosed.
This file is that disclosure. Keep it accurate; update it whenever either list changes.

## Work that existed before the event started (4 October 2026, 10:00 IST)

The initial scaffold was prepared on 2 October 2026 as a starter template. Later work on that date
is listed separately below; it must not be described as built during the event. The team confirmed
that development may begin before the event, as recorded in `AGENTS.md`.

| Area | What existed |
|---|---|
| Project scaffold | Angular 21 app generated with the Angular CLI, Angular Material, routing with placeholder screens, build and test configuration. |
| Plumbing | Supabase browser client with anonymous sign-in, an `/api` client, a route guard, a local API dev server, environment handling, `vercel.json`. |
| Infrastructure endpoints | `api/health`, `api/whoami`, `api/llm-check`, used only by the `/status` diagnostics page. Codex added usage charging to model diagnostics on 2 October 2026. |
| Server helpers | JSON and error helpers, token verification, model provider handles (no prompts, no agent). |
| Shared contract | Fact field names and statuses, upload limits, ladder step names, API and database row types. |
| Database | `supabase/migrations/0001_init.sql`: tables, row-level security, storage rules, usage-limit function; plus tests for those rules. |
| Documents | `docs/SPEC.md`, `docs/BUILD_PLAN.md`, `AGENTS.md`, this file. |
| Visual design (Claude, 2 October 2026) | Design tokens, presentational case components and view models, home and new-case screens, and `/demo` with invented sample data. |
| T1 (Codex, 2 October 2026) | Case creation, private evidence upload, document rows, and My cases with stored steps and dates, using the existing design system. |
| T2 (Codex, 2 October 2026) | Tool-free document reader, charged calls, reading endpoints and exclusive turn claims with atomic results. Hosted PDF and image reading, repeated start and stale turn checks passed. |
| T3 (Codex, 2 October 2026) | Real case rows drive the existing case components. Sequential reading, saved progress, private image and locally rendered PDF-page previews, source quotes and keyboard access. |
| T4 (Codex, 2 October 2026) | Code normalisation, literal PDF text-layer quote checks, one charged image-quote pass, conflict detection and the five-status fact-sheet builder. Changes are returned for T5's turn transaction. |
| T5 (Codex, 2 October 2026) | Resumable investigating loop, eight validated tools, paused questions, checked-guidance state and atomic saves using caller-scoped SQL. Scripted model tests; hosted persistence reused prior quote results with zero new model calls. |

The initial starter did not include document reading, verification, the agent loop and its tools,
the escalation ladder, drafting and the linter, the evaluation set, or product screens. These are
being built in plan order. Completed work is recorded below with its actual date.

On 2 October 2026, Codex read the handover and project instructions, ran `npm run check`
(both server type-checks, 49 server/database tests, 2 Angular tests and a production build passed),
and prepared an ignored `.env.local` from `.env.example` for Phase 0 setup. No core product code
was added. At that point, hosted Supabase, deployment and real model checks remained pending.

Codex also corrected the existing `api/llm-check` infrastructure endpoint to call
`charge_model_call()` before a model request, stop when the charge is refused or cannot be
confirmed, and disable SDK retries so one diagnostic attempt makes one charged request.
Twelve tests use fake model calls; the final `npm run check` passed both type-checks,
61 server/database tests, 2 Angular tests and the production build. The local `/status` page and
proxied `/api/health` both returned HTTP 200, with all account settings still missing at that point.

Later on 2 October 2026, after the owner configured the Mumbai Supabase project and saved the
account settings, Codex ran the local `/status` page using the computer-use plugin. The first
sign-in failed because `SUPABASE_URL` included `/rest/v1/`; Codex corrected the ignored local
setting to the project origin and restarted the app. All six local infrastructure checks then
passed. Two real, charged model diagnostics answered `ok`: Google `gemini-3.8-flash` in 3,073 ms
and Groq `qwen/qwen3.8-27b` in 190 ms. These are diagnostic call durations, not product evaluation
results. The database reported zero guidance snippets. Hand-checked guidance, quota review and
deployed checks remained pending at that point; core product work had not started.

On 2 October 2026, Claude built the visual design layer: design tokens and theme, the
presentational components in `src/app/shared/ui/`, a redesigned home page and app shell, the
new-case screen with its file rules, and `/demo`, which shows the case screen with invented
sample data (fictional seller, no model output). No agent, reader, ladder or drafting logic is in it.

On 2 October 2026, Codex checked and committed that visual layer, clicked through `/demo`, and
implemented T1 using its existing components and view models. Consent is checked before any
upload, files are validated in both the screen and service, and failed new uploads attempt to
remove their own files before their case row. A partial case is retained and linked if cleanup
fails. My cases shows document counts and stored steps and deadlines without inventing them.

T1 manual checks used three locally generated synthetic PDFs for fictional Meridian Mart.
Hosted Supabase returned three document rows labelled E01–E03 and successful storage uploads
under the signed-in user's case folder. Selection and case opening were checked by keyboard at
360 px, with no horizontal scroll. Axe-core 4.13.0 reported zero WCAG A/AA violations and zero
incomplete checks for the upload screen and My cases after a dropzone caption contrast fix using
an existing text token. T1 used zero model calls. `npm run check` passed both type-checks,
61 server/database tests, 30 Angular tests and the production build. Reading and investigation
remain for later tasks; deployed checks, guidance confirmation and quota review remain pending.

On 2 October 2026, Codex implemented T2's server-side document reader with schema-constrained
output and no tools, central model usage charging, and authenticated start/advance endpoints.
The new `0002_agent_reading.sql` migration adds caller-scoped, security-invoker turn claims and
an atomic commit of the document result, evidence items, event and turn. Image fallback is deferred
to the next request so no request makes two model calls. Provider rate limiting releases the claim
and returns a delay without advancing the turn; every attempted provider call is still charged.
Tests use fake calls and in-process Postgres. At the first preparation checkpoint, hosted migration
and live PDF/image acceptance checks had not been run. That preparation used zero real calls.
`npm run check` passed both type-checks, 95 server/database tests, 30 Angular tests and the
production build. An unauthenticated request through the local Angular proxy to the new start
endpoint returned the expected HTTP 401 and plain sign-in message.

The owner supplied AI Studio readings of RPM 1/5, TPM 8/250K and RPD 1/20 on 2 October 2026.
These were interpreted as used/limit, with limits of 5 requests per minute, 250,000 tokens per
minute and 20 requests per day. The new migration prepares app-wide daily caps of 8 per user
and 15 globally, including calls to either provider. The owner subsequently confirmed that
`0002_agent_reading.sql` ran successfully in the hosted project's SQL Editor.

T2 live checks on 2 October 2026 created a second test case in the existing anonymous session,
with a generated, fictional two-page invoice PDF and support screenshot. Hosted start was
idempotent and stale advance returned HTTP 409 with the current turn. Six charged provider
attempts were made: five primary attempts failed and one image fallback returned six candidate
facts, with source quotes and page 1, stored in `evidence_items`. The PDF attempt still failed;
T2 was incomplete at that checkpoint and these results are not evaluation metrics. One API retry returned 401
because the temporary session token expired; refreshing the existing browser sign-in fixed
authentication and that refused request used no model call.

The initial primary errors included Google's "Request contains an invalid argument" and rejection
of the MIME string in `responseFormat.text`. Codex added a tested transport adapter using the
REST reference's `APPLICATION_JSON` enum and a simpler provider schema; strict local Zod
validation still enforces fact fields, nonempty quotes, lengths and positive integer pages.
The corrected reader is tested through the actual SDK with fake HTTP responses. The live PDF
failure at that checkpoint was unresolved. Bounded failure diagnostics redact configured credentials.

The hosted usage function then returned `allowed: false`, `reason: user_limit`, `user_calls: 8`
and `user_limit: 8` (two earlier setup diagnostics plus six T2 attempts). No further provider call
was made. `0003_development_quota.sql` prepares a per-user cap of 12, retaining the global cap
of 15. Further live reading checks waited for the owner to run it.
At that checkpoint `npm run check` passed both server type-checks, 101 server/database tests,
30 Angular tests and the production build. T2 was not committed while the PDF check failed.

The owner subsequently confirmed that `0003_development_quota.sql` ran successfully. One
additional charged primary call then read the two-page invoice successfully, returning eight
candidate facts with quotes from pages 1 and 2. These and the six image candidates are stored in
the hosted case; both documents have `read_status: read`. A following advance made no model
call and moved the run to `investigating`. T2's complete manual check used seven charged attempts
(six primary, of which five failed, and one successful fallback), in addition to the two setup
diagnostics. These are manual fixture results, not product evaluation metrics. The upload notice
now names Groq as a possible image fallback recipient before consent. T3 and investigation remain
to build; quote confirmation remains T4, so these candidates are not labelled stated in document.

On 2 October 2026, Codex implemented T3 using `CaseWorkspaceView`, `FactList`, `SourcePanel` and
the existing view models. The screen restores the caller's case, document readings, fact rows,
run and events. Requests advance serially through reading, recover a stale turn, wait on provider
rate limits and stop on daily caps or network errors. Investigation remains T5; no investigation
request is made yet. Candidate facts remain "Needs your check" until T4 confirms their quotes.

T3 sources use ten-minute signed Storage links, refreshed on reopening after nine minutes.
PDF pages render locally with the installed unpdf library after the browser's native embedded
viewer showed a blank preview. The source components remain free of database and API calls.
Locally created page image URLs are released when leaving the case. A source heading's CSS
class was renamed to avoid a collision with the global page container class. Tabs now support
arrow keys, Home and End, with labelled panels; phone sources trap focus, close with Escape and
return focus to the selected fact.

Manual T3 checks reopened the hosted two-document case and checked all fourteen fact rows:
ten fields showed their stored sources and quotes, including both invoice pages; the four absent
fields showed no invented source. Images and both PDF page previews rendered. Facts, Activity,
Plan and Complaint had no horizontal page scroll at a 360 px viewport. Reload restored the same
saved readings with no new model call; the browser reported no console errors. Axe-core 4.13.0
reported zero violations with all rules. It left manual checks for CDK focus-trap anchors and text
obscured by the phone sheet or highlighted with a gradient; focus trapping, return focus and the
visible text were checked manually. This is browser accessibility checking, not a real screen-reader
user study. T3 used zero model calls. Unit tests cover row mapping, duplicate-document quotes,
turn recovery, rate limits, quota/network stops, leaving during a request, private links, sources,
keyboard tabs and unavailable cases. `npm run check` passed 101 server/database tests, 55 Angular
tests, both server type-checks and a production build. Verification and investigation remain to build.

On 2 October 2026, Codex implemented T4's amount, date, duration, ID and boolean normalisers,
conflict detection and fact-sheet builder. Amounts use decimal strings; day-first numeric dates are
validated without rolling invalid dates into another month; duration ranges take the stated upper
bound. An explicit absent bank reference is represented as absence rather than an ID. Unconfirmed
quotes and unparseable values retain "Needs your check"; user choices remain "Your statement".
PDF quotes are checked against the named text-layer page, with only whitespace normalised.
The image quote pass has no tools, charges before its one call, disables retries and requires an
answer for every requested ID without duplicates or invented IDs. Already checked image quotes
are not automatically charged again.

T4's read-only manual fixture check used two charged attempts: Gemini returned HTTP 503
(high demand), then the configured Groq fallback confirmed the six screenshot quotes in one call.
The code check found all eight invoice quotes on their named pages. The resulting sheet contained
ten document fields and four missing fields, merging both amount formats and retaining the explicit
absent reference. These are fixture checks, not evaluation metrics. The generated results are local
and ignored; hosted evidence and fact rows were not changed. Automatic quote checking and atomic
fact persistence will be connected in T5. No migration is needed for T4's existing row shapes.
`npm run check` passed both server type-checks, 174 server/database tests, 55 Angular tests and
the production build. Tests include mixed formats, invalid dates, wrong-page quotes, real PDF bytes,
different refund dates, refused charges, incomplete image responses and already checked images.

<!-- Team: add anything else prepared before the start (guidance snippets, synthetic test
     documents, interview notes) and the date it was prepared. Delete this comment when done. -->

On 2 October 2026, Codex implemented T5's investigating loop and eight tools. Each request either
chooses and runs one tool, performs a queued tool-free reread, or checks source quotes. These are
separate requests, charged before their model calls, with retries disabled. Questions pause the run;
the latest actual answer resumes without a model call and is stored as "Your statement". Checked
guidance and code decisions are saved between turns; plans require checked guidance and a code
decision. The pure ladder is intentionally still unavailable until T7. No automatic investigation
calls are enabled in the browser until its question controls are connected in T6.

The owner confirmed applying `0004_agent_investigation.sql`. It adds structured continuation
state and a security-invoker transaction for evidence, facts, questions, plans, events and turn.
Hosted checking reused the unchanged T4 fixture results, saved fourteen quote checks and fourteen
fact rows (ten document fields, four missing), advanced turn 7 to 8 and refused a replay. This
used zero additional model calls. Scripted tests cover plan selection, conflict/question/resume,
reread/question, scope, the step ceiling, invalid inputs, refused charging, latest-question handling
and holding the claim through a save. Fake HTTP through the actual model SDK checks eight portable
tool schemas, one-tool selection and no provider retries. These are development checks, not
evaluation measures. Guidance rows, live investigation, deployed checks and later tasks remain.
`npm run check` passed both server type-checks, 197 server/database tests, 55 Angular tests and
the production build. Twenty-seven database tests cover the migrations including atomic rollback,
caller ownership, question pause/resume and unapproved plans. Browser reload displayed the saved
document statuses with no new model call.

On 2 October 2026, at the owner's request before completing T6, Codex replaced the fixed
primary/fallback pair with configurable vision and text lineups. PDF pages with text are extracted
with unpdf and sent as text; scanned PDFs remain on the Google vision lineup. Groq receives
images or extracted text, never binary PDFs. Each logical call is charged once before its first
attempt. Quota, rate-limit, high-demand and timeout failures move immediately to the next model,
with SDK retries disabled and an eight-second maximum attempt timeout. Signed server receipts
record shared cooldowns through a restricted database function. Clients cannot write the table,
read the signing secret, forge a reset time or replay a receipt to extend it. The owner confirmed
applying migrations 0005 and 0006 and the private signing setup SQL. Caps are 15 per user and 15
globally, retaining earlier charges.

The owner's supplied reading benchmark contains eleven earlier direct attempts outside the app's
counter. Its original table and JSON are retained in `eval/model-benchmark.*`; Codex did not rerun
them. They measure two clean synthetic documents, not tool choice, drafting or text-extracted PDF
reading. The script now requires an explicit live budget of at most six attempts and uses caller
charging and signed cooldowns. Future runs write separate output files.

The new router's bounded live check used six provider attempts and three logical charges. Qwen
read the extracted two-page invoice text, returning nine candidates across five expected fields.
Gemini 3.6, 3.8 and 3.5 each timed out at eight seconds; Flash Lite then read the screenshot and
returned six candidates. Three signed timeout cooldowns were saved. Qwen chose `get_next_step`,
and the run and tool-call event recorded its ID. That tool failed because T7 was still unavailable;
this was not an end-to-end investigation success. Results and limits are in
`eval/model-benchmark.md` and `eval/model-routing-live.json`. Fake providers cover routing and
skipping; Qwen's literal "None" bank reference is tested as absence.

A read-only audit also found one earlier charged tool-selection failure after T6 enabled browser
investigation on the existing T2 fixture, before these routing checks. No usable tool was selected.
Together with eleven earlier setup/reading/quote charges and the three new logical charges,
this session has used fifteen charges on 2 October. T6's separate saved conflict/question fixture
uses no model calls; its UI work is still to be completed and committed after routing.
Before the routing commit, the working-tree `npm run check` passed both server type-checks,
216 server/database tests (including the pending T6 answer tests), 59 Angular tests and the
production build. The staged routing commit leaves the pending T6 UI and answer endpoint separate.

On 2 October 2026, Codex completed T6 by connecting the existing `QuestionCard` and activity log
to caller-owned questions and events. Offered answers take one tap; questions without choices
use a labelled text field. Saves reject invented choices, superseded questions and overwrites.
The answer endpoint stores the answer conditionally, then resumes the waiting run without a model
call. The browser refreshes and continues serially, retaining the case during errors and recovering
a saved answer after a dropped response. A new question clears the previous text input. Question
headings receive focus; when answered, focus returns to Facts. Presentational components still
contain no API or database calls, and the existing layout and tokens are retained.

The manual T6 fixture was explicitly scripted development data: a saved conflicting refund amount,
one question, no documents, and a pre-set ten-step ceiling to avoid a further model call. At 360 px,
answering with the keyboard saved INR 9999 as "Your statement", resumed without reload, removed
the question and then reached the expected ceiling. The activity log showed the actual answer
and ceiling events. There was no horizontal scroll or browser console error. Axe reported zero
violations and no incomplete checks on the activity view; keyboard focus was checked manually.
Reload restored the saved statement. This fixture used zero provider calls and is not a live-model
conflict evaluation. The earlier unrelated investigation call is disclosed above. No new migration
was needed for T6. The pure ladder, plans and subsequent tasks remain to build.
`npm run check` passed both server type-checks, 216 server/database tests, 60 Angular tests
and the production build before the T6 commit.

On 2 October 2026, Codex implemented T7's pure refund ladder, separate definition and date helpers,
and connected them to `get_next_step`. The engine receives an injectable India calendar date.
It follows the specification's order, pauses on conflicting/unchecked decision fields, waits on
the due date itself, escalates only after the two-day or calendar-month boundary, and clamps
month-end dates. Working days skip weekends and disclose that holidays are not handled. The
seven-day assumption requires an explicit user statement that no date was given and is labelled
as a working assumption, not a rule. A reference alone does not establish processing: the bank
branch also needs a narrow affirmative processing statement in the checked source quote supporting
that reference. No extra fact field or model inference was added. Step three is information only
and requires explicit unresolved-helpline context; connecting that user outcome remains T11.

Thirty-nine ladder/date/adapter tests cover all nine rules, precedence, conflicts, unknown
acknowledgement, an absent reference including "None", negated/future processing claims, weekends,
leap days, month ends and the India date boundary. A read-only check against the existing hosted
T2 fact sheet returned step one for the 24 September due date and no recorded complaint date on
2 October. It changed no row and made zero model calls. This is a fixture check, not an evaluation
score or a completed live investigation. Guidance rows, plan UI and approval remain T8.
`npm run check` passed both server type-checks, 255 server/database tests, 60 Angular tests
and the production build before the T7 commit.

On 2 October 2026, Codex completed T8's saved plan mapping, timeline and caller-owned atomic
review. The existing PlanPanel and CaseWorkspaceView are reused, with keyboard approval,
request-change and reject controls, saved review events and focus management. Step zero has
nothing to send; step three is information only. No review action calls a model or creates a draft.
Code decision notes, including the seven-day assumption and working-day holiday limitation, are
retained. The timeline explicitly distinguishes the recorded sent date used in calculations from
receipt under rule 4(5). The owner checked all six guidance texts against primary sources on
2 October, correcting the bank example to a cancelled online train-ticket case. That exact text
and date are in the seed; the owner confirmed applying migration 0007 and the seed.

Three labelled scripted hosted cases exercised the real ladder, tool runner, RLS and atomic
plan save without a provider call. The waiting case showed step zero and 10 October; the overdue
case showed step one and 24 September. Keyboard approval persisted both, with zero drafts. The
review case was rejected, then given a scripted sent date of 1 October and a fresh proposal,
which showed 3 October and 1 November with the receipt caveat. Request-change archived that
proposal and created one saved free-text question, restored on reload with focus on its heading.
The source links and owner-checked dates appeared in the existing plan component. This checks
code and persistence, not live-model investigation or extraction accuracy. The hosted counter
remained at fifteen; T8 used zero provider calls.

At 360 px the plan and change question had no horizontal scroll or console errors. Axe found
zero violations on both; the plan had no incomplete checks. The change question had one incomplete
contrast rule because its existing background is a gradient. Manual calculation against both
computed gradient endpoints found minimum text contrast ratios of 5.61:1, 16.32:1 and 8.17:1
for its three text colours, exceeding 4.5:1. Keyboard focus was also checked. The full check passed
both server type-checks, 268 server/database tests (including 37 database policy/seed tests),
70 Angular tests and the production build. Drafting and later tasks remain to build.

On 2 October 2026, Codex implemented T9's approval-gated placeholder drafting, code rendering,
shared value linter, versioned edit saves and printable pack. It reuses the existing complaint
component and case layout. The owner confirmed applying migration 0008. A generation claim
prevents concurrent initial drafts; an invalid template gets one repair, each logical call charges
separately, and both share a forty-five-second deadline. The text lineup supplies the prose with
no tools or SDK retries. Code inserts fact values and their source labels. Personal name, contact
and address fields are filled locally and never included in the save request or model prompt.
Typed complaint text is saved, with a clear notice to use the separate private fields.

Tests and a hosted scripted fixture checked renderer rejection, seeded linter failures, known
values, ownership, claim recovery, duplicate replay, repairs, model records and edit versions.
At phone width a made-up ID visibly flagged and could be kept as a user statement; copy included
local synthetic personal details and source labels. The database retained placeholders and did
not contain those personal details. The pack had no horizontal scroll or console warnings/errors
and zero axe violations or incomplete checks. Its browser-produced two-page PDF was rendered
with Poppler and visually inspected; the print controls were absent. This case uses a scripted
template and user-stated due date, not model extraction. It has no uploaded documents. The
populated evidence index is tested with component data; source viewing had earlier T3 checks.
These checks used zero provider calls and the hosted counter stayed at fifteen. Live model
drafting and the deployed journey have not been checked. Amounts written solely in words and
prose claims are known scanner limits; the editor tells the user to review the prose too.
The full check passed both server type-checks, 318 server/database tests (including 42 policy/seed
tests), 79 Angular tests and the production build. See `docs/t9-checks.md` for the scope and evidence.

On 2 October 2026, Codex implemented T10 sent-date recording and a browser-generated calendar
download, using the existing complaint screen and design tokens. The owner confirmed applying
migration 0009. A caller-scoped transaction records the sent date as a user statement and updates
the case, plan deadlines and activity event together. Replays do not duplicate evidence; explicit
corrections are allowed. Only an approved step-one complaint with a saved draft can be recorded.
The interface says the user sends it themselves and retains the sent-versus-received date caveat.

The hosted scripted fixture recorded 1 October, with deadlines of 3 October and 1 November.
At 360 px there was no horizontal scroll, no console warnings/errors, and no axe violations or
incomplete checks. Although the browser download-event waiter timed out, the actual local `.ics`
file was found in Downloads and its three all-day dates matched the stored plan. Unit tests check
calendar escaping, UTF-8 folding, year-end rollover and month-end arithmetic, alongside caller
ownership, approval, replay and date-validation checks. The owner's calendar-app preview remains
pending; the owner explicitly authorised continuing with T11 and later tasks while deferring
that check. These checks used zero provider calls and the counter
remained at fifteen. The full check passed both server type-checks, 334 server/database tests
(including 46 policy/seed tests), 83 Angular tests and the production build.
See `docs/t10-checks.md` for evidence and the remaining check.

On 2 October 2026, Codex implemented T11's four outcomes, consented refusal-reply upload and
caller-owned, replay-safe continuation with migration 0010, which the owner applied. Code
recomputes the ladder; refusal files use the existing reader and quote checks. Waiting plans
cannot produce a duplicate letter. Earlier approved complaints and draft versions are retained.
The existing presentational case layout and design tokens were reused.

The hosted synthetic fixture reached step two after no reply. Caller-scoped approval and an
injected scripted generator saved helpline-shaped text using the same facts; the model label
explicitly says `scripted-test-no-provider`. Browser checks reopened its complaint and pack at
360 px with no horizontal scroll, no console warnings/errors and no axe violations or incomplete
checks. Acknowledgement produced a waiting plan, and refund arrived resolved the case. All three
saved draft versions remained in the database. The full check passed both type-checks, 351
server/database tests (52 policy/seed tests), 90 Angular tests and production build. Zero provider
calls were made; usage remained at fifteen. Refusal reading and helpline drafting with real
models remain unverified. See `docs/t11-checks.md`.

On 2–3 October 2026, before the event, Codex prepared T12's twelve-case synthetic corpus and
29 documents using a committed Python generator with ReportLab/Pillow. Expected facts, ladder
outcomes, pauses and simulated answers were authored separately from model output. All text-PDF
source lines were checked after unpdf extraction; the rendered documents were visually inspected.
The blurred image is intentionally unreadable. No real consumers or transactions are represented.

Codex added an evaluation runner using the production reader, quote checker, investigation loop,
ladder, caller-scoped Supabase transactions and draft generator, with fixed evaluation dates,
checkpointed progress, actual model labels, call budgets and scoped synthetic-case cleanup.
Optional asynchronous instrumentation counts successful logical charges and SDK provider attempts;
it does not replace or bypass database quota charging. A local budget stop cannot mark a provider
exhausted. Fake-operation tests cover pauses, canonical answers, fixed dates, draft resumption,
cooldown stops and cleanup boundaries. The dry run used no database or provider calls. The report
at preparation recorded zero of thirty-six live runs, with product metrics explicitly pending. Three
deterministic linter probes passed. The full live run awaited the owner's approval and temporary
dashboard caps; no live evaluation results are claimed.
The full preparation check passed both server type-checks, 371 server/database tests, 90 Angular
tests and the production build. Details and the remaining acceptance gate are in
`docs/t12-preparation.md`.

On 3 October, the owner approved T12's live evaluation in two stages and confirmed temporary caps
SQL succeeded. At the owner's request following a Claude review, Codex corrected the dashboard
budget SQL to use India dates, matching the existing database usage counter. Codex added explicit
answering-model/fallback telemetry and repetition selection so interrupted first-stage results
remain available. The approved total is 300 logical charges across both providers and 450 SDK
attempts; stage two requires a further owner reply.

Stage one ran on 3 October with the production operations and real providers. It used 36 logical
charges and 44 SDK attempts: Google 24 attempts/19 successful routed responses, Groq 20 attempts/12
responses. Seventeen of 31 successful responses used a fallback model, including stored-cooldown
skips. The caller's India-day database counter increased from no row to 36, matching the checkpoint.
Two runs finished but failed acceptance: the clean case acquired a false order-ID conflict after
the reader classified the fictional-document footer as an ID, and the conflicting-amount case
repeated rereads until its ten-choice ceiling. Four further cases stopped on model cooldowns,
two without a provider attempt. Six could not start because retained interrupted cases brought
the account to its ten-case limit. No live draft or complete injection run was produced.
All twelve first-stage outcomes, answering models, fallbacks, failures and spent calls are saved;
interrupted outcomes are not scored as successes. Stage two was not run. Full consistency and
product-evaluation acceptance remain pending. See `docs/t12-stage-one.md` and `eval/report.md`.

On 3 October, the owner rejected stage two for now and requested failure fixes plus a stage-one
rerun capped at forty logical calls. Codex traced the original JSON audits, corrected permissive
ID normalisation and whole-response rejection, added persisted repeat detection and source-backed
conflict choices, reduced active tool schemas and added local pacing and token telemetry. The
owner supplied Groq limits of thirty requests and eight thousand tokens per minute. Provider
fallback remains immediate with no SDK retries; waits happen between local runner advances.
The four retained evaluation cases and their files were cleared after audit checks, with no model
calls. Six prior fixtures remain and usage stayed at thirty-six. Offline SDK serialization measured
request bytes; no provider token counts are inferred from those bytes. Actual token measurements
were then captured in the capped rerun after the owner confirmed its dashboard caps step.

The rerun ran across 3–4 October, spending forty logical charges and forty-one SDK attempts:
Google three attempts/two responses; Groq thirty-eight attempts/thirty-eight responses. Five
cases finished, two with correct outcomes; one stopped on the local budget and six never started.
The correct clean order ID no longer conflicted, but extraction still omitted receipt facts and
mislabelled readable PDFs as unreadable. The first actual tool choice measured 1,827 prompt
tokens; twenty-two choices ranged from 1,304 to 1,827. No Groq HTTP response was rate-limited.
An offline pause at twenty-two charges preserved the checkpoint while Codex corrected guidance
retrieval: full-text search omitted IDs, so broad queries and literal IDs returned no sources.
Exact-ID lookup and retrieval of code-required sources retain the checked-guidance policy. The
first two failed observations were not rerun; the mixed revision of the third case is disclosed.
The final code check passed 397 server/database tests, 90 Angular tests, both type-checks and build.
Caller-owned verification found zero evaluation rows in nine case tables and zero entries in
twelve storage prefixes; six older fixtures remain. Usage was 46 on 3 October and 30 on 4 October,
an increase of exactly forty from the pre-pass 36. The owner confirmed caps restored to 15/15; no counter
was reset. No live draft or injection run finished, no stage two ran, and T12 remains incomplete.
See `docs/t12-fixes.md` and `eval/rerun-stage-one-report.md`.

## AI tools used

| Tool | Used for |
|---|---|
| Claude (Anthropic), via Claude Code | Reading the brief, comparing project options, writing the specification, building the starter template and visual design layer above. The owner also supplied its evaluation-budget review on 3 October. |
| ChatGPT (OpenAI) | Independent review of the project options and the specification. |
| Codex (OpenAI) | Pre-event handover review, T1–T11 implementation, T12 corpus/runner, stage-one evaluation and capped rerun fixes, model routing with signed cooldowns, browser checks and local session refresh through the computer-use plugin, and PDF-skill fixture preparation and print inspection on 2–4 October 2026. |
| Google Gemini API | Setup, document reading, quote checks and the owner-supplied reading benchmark; routing verification had three timed-out vision attempts and one successful Flash Lite image read on 2 October. Original stage one used 24 attempts/19 routed responses. The capped rerun used 3 attempts/2 responses. Incomplete evaluation failures are reported above. |
| Groq API | Setup, image reading and quote checking, the owner's supplied Qwen benchmark, and two successful Qwen text-routing fixture checks on 2 October. Original stage one used 20 attempts/12 routed responses. The capped rerun used 38 attempts/38 responses, including actual token metering. Incomplete evaluation failures are reported above. |

<!-- Team: add any other tool that made a significant contribution (for example a design or
     video tool), and correct anything above that does not match what you actually used. -->

## Research done before the event

<!-- Team: list interviews, the survey, and the primary sources read for the guidance snippets,
     with dates. The rules allow research before the event; state it anyway. -->
