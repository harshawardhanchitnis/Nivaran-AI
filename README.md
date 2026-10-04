# Nivaran AI

Turn scattered refund documents into a source-linked fact sheet, a next step with dates, and a
complaint pack you review and send yourself. Built for WCC Launchpad 30, Track 1: Agentic AI.

**Scope:** an online order with a refund already owed that has not arrived. A cancelled prepaid
order, an accepted return or a written refund confirmation qualifies. Bank/UPI disputes and
disputes over whether a refund is owed are outside scope.

**Current status, 4 October 2026:** the local journey, saved samples and deletion are implemented.
The latest full check passed **430 server/database tests, 97 Angular tests, both server type
checks and the production build**. The [public app](https://nivaran-ai-green.vercel.app) passes
all six infrastructure checks in Mumbai and both model diagnostics. All five Saved runs work
at phone width. The bounded deployed journey produced a grievance draft, passed editing/copy,
sent/outcome persistence and deletion, but helpline drafting failed validation. Diagnostics are
now disabled. Full acceptance remains incomplete. See [the deployment report](docs/deployed-journey.md).

## Try it

Open [Nivaran AI](https://nivaran-ai-green.vercel.app), or run locally. Five cards open **Saved runs** of fictional cases with
their recorded facts, activity, sources, decisions, answering models and failures. Replay makes
no model calls. A live run is offered only while quota advice shows capacity; upload consent
and Continue are required. Saved dates belong to the recorded run, not today.

| Saved run | What it shows |
|---|---|
| /samples/clean-overdue | Overdue plan and grievance draft; the omitted receipt fact is still Missing. |
| /samples/conflicting-amounts | Two refund amounts, the actual question and recorded answer, then a grievance draft. |
| /samples/not-yet-due | A waiting plan from the earlier 40-call rerun, explicitly labelled with that provenance. The final pass asked an unnecessary question. |
| /samples/already-complained | The helpline plan; two rejected live draft templates and no saved draft. |
| /samples/out-of-scope | The actual out-of-scope result with the failed document read disclosed. |

/demo is the original **invented visual example**, not a measured model run.

## The problem and its evidence

The design hypothesis is that an owed refund becomes harder to pursue when the order, refund
promise and follow-up messages are scattered across documents. Nivaran puts each stated value
beside its source and gives the consumer a reviewable next action.

Interview/survey results and independent phone-user findings have **not been supplied**. We claim
no response count, prevalence, time saved or recovery rate. [Problem evidence](docs/problem-evidence.md)
lists this gap. Six guidance snippets were checked by the owner against primary sources on
2 October 2026; [the review](docs/guidance-review.md) records the corrections and caveats.
Those sources establish the guidance basis, not validation of consumer demand.

## What the product does

1. Anonymous sign-in and consented private upload: up to six PNG/JPG/PDF files, 5 MB each.
2. Read each document with page/quote candidates. Text-layer PDF quotes are matched in code;
   image quotes receive a weaker second model check. Tap a fact to open the source page.
3. Show five statuses: Stated in document, Your statement, Conflicting, Missing, Needs your check.
   Conflicts stay visible for the user to decide. A document states something; it does not prove it happened.
4. Investigate with validated tools, a saved activity log and questions. Code constrains the
   useful next actions and computes escalation, arithmetic and India dates.
5. Review the plan, its checked guidance links and deadlines, then approve, request a change or
   reject. Only approval permits drafting. The consumer sends or files the complaint themselves.
6. Model prose uses placeholders. Code inserts amounts, dates and IDs with evidence labels.
   The shared linter flags unsupported values in generated text and user edits; it does not
   establish the truth of prose. The pack includes the complaint, timeline and evidence index.
7. Record a sent date, download an all-day calendar file and record the outcome. A no-reply or
   refusal path can lead to helpline text; earlier drafts remain saved.
8. Confirm deletion in My cases. Remove private objects first, then the case and all child rows.

The escalation order is recommended practice; Nivaran is not legal advice. Complaint deadlines
are calculated from the recorded sent date, while rule 4(5) counts from receipt; the plan says
to adjust for later receipt. Seven days without a merchant date is an explicit working assumption,
not a universal legal deadline. Working days skip weekends, without a public-holiday calendar.

## Architecture and controls

Angular 21/Material uses the existing presentational workspace and design tokens. Vercel Functions
run Node 22 in the configured Mumbai region. Supabase provides anonymous auth, Postgres and private
storage. unpdf extracts text and renders PDF source previews; the AI SDK connects the providers.

| Boundary | Responsibility |
|---|---|
| Browser → caller-scoped API | Consent, expected turn, questions, plan review and edits. |
| Tool-free document reader → provider | Candidate facts with exact source quotes; documents are untrusted data. |
| Code → saved facts and plan | Normalisation, quote matching, conflict detection, arithmetic, India dates and ladder. |
| Model → validated tool or placeholder draft | Choose an offered useful action; explain and write prose. |
| Code → consumer-reviewed pack | Insert fact-sheet values, check unsupported amounts/dates/IDs, preserve evidence labels. |
| Caller token → Postgres/private storage | Row-level security and ownership; no administrator client. |

Each advance request makes **at most one logical model call and runs at most one tool**. Exclusive
claims and the expected turn protect replay/concurrent requests; run state lives in Postgres and
survives a closed tab. Ten model-chosen steps is the ceiling. Repeated identical tool/input calls
trigger a code guard; required conflicts/gaps, unreadable files and already-loaded guidance
constrain offered choices. These later guards have fake-provider regression tests, not a new
measured accuracy score.

Every Supabase client acts as the caller with row-level security. There is no service-role key.
Guidance, usage counters and availability cannot be changed directly by clients; cooldown writes
need an authenticated RPC with a signed server receipt. A user can still change permitted rows
within their own case; their own log is not a tamper-proof audit of events.

Reading calls have no tools, and raw document text is never placed in the tool-using loop as
instructions. No agent tool sends, pays, files or deletes. Name/contact details are filled locally
in the browser and are not sent to the draft model or persisted.

## Model routing and quota

| Task | Configurable default order |
|---|---|
| Images; PDFs without a usable text layer | Gemini 3.6 Flash, 3.8 Flash, 3.5 Flash, 3.5 Flash Lite, 3.7 Flash, then Qwen **for images only**. |
| Reading unpdf-extracted PDF text | Gemini 3.5 Flash Lite, 3.5 Flash, 3.6 Flash, 3.8 Flash, 3.7 Flash, then Qwen. |
| Tool choice and drafting | Qwen, Gemini 3.5 Flash Lite, 3.5 Flash, 3.6 Flash, 3.8 Flash, 3.7 Flash. |

Exact model IDs and all three env names are in [.env.example](.env.example). Groq never receives
PDF file bytes. An unreadable/empty text-layer PDF result tries each next reader once within the
same logical call. Quota, rate-limit, high-demand and timeout errors fall through immediately;
SDK retries and handler sleeps are disabled. Stored cooldowns are skipped until usable. If every
suitable model is unavailable, the response supplies retryAfterMs and preserves the turn.

Charge the database **once before the first attempt**, even if later validation fails. Fallback
attempts share the charge; the actual answering model is recorded. Normal app caps are fifteen
logical calls per user and fifteen globally per India day. These are app limits across both
providers, **not fifteen Gemini attempts**, and fallback can spend additional provider requests.
The final evaluation used a temporary owner-applied budget. Restoration after that pass still
needs owner confirmation. Never reset usage or leave evaluation caps on a public deployment.

Upload consent explains that documents/extracted facts may go to Google Gemini or Groq Qwen,
and Google may use free-tier content to improve its products. Users should hide private details
before upload. Public samples contain only fictional documents.

## Measured evaluation

The corpus has twelve fictional cases and 29 generated documents. Three runs each were planned;
the owner authorised bounded passes and then stopped evaluation permanently. **The full T12
acceptance is incomplete.** The final pass ran revision 3906f5b throughout on 4 October, with
the decision date fixed to 2 October 2026. It predates the T14 action guards.

The [final report](eval/final-stage-one-report.md) and [per-run audits](eval/results/final-stage-one)
are the source of the numbers below. Expected facts were authored separately and scored before
scripted answers. The runner used production operations, not the deployed HTTP/browser journey.

| Required measure | Final measured result |
|---|---|
| Facts correct, per field | The table below; includes expected-absent fields. |
| Quote checks passed | **89/89** extracted document quotes. This is literal matching, not extraction coverage. |
| Correct ladder/outcome and pauses | **7/8** outcome/step; **5/8** exact pause sets. Completed failures are included. |
| Same result over three runs | **0/0 completed triples**; all twelve cases still lack three runs. No consistency claim. |
| Seeded linter errors caught | **3/3** local deterministic probes: amount, date, ID. No model was used. |
| Calls and time per run | The run table below; time includes runner pacing waits. |

**8/36 required runs finished**, including failures. One additional run was budget-interrupted;
three cases never started. Spent calls include interruptions: **70 logical charges / 75 provider
attempts**, comprising **Google 27 attempts / 22 successful routed responses** and **Groq 48 / 48**.
One of seventy successful routed responses was a fallback response. Routed success can still
fail extraction, tool or template validation; it does not mean product acceptance passed.

| Field | Correct / observed finished runs |
|---|---|
| merchant_name | 8/8 |
| order_id | 8/8 |
| order_date | 8/8 |
| item_description | 7/8 |
| amount_paid | 8/8 |
| cancellation_or_return_date | 8/8 |
| refund_amount | 8/8 |
| refund_promise_date | 8/8 |
| refund_due_date | 8/8 |
| refund_reference | 8/8 |
| complaint_sent_date | 8/8 |
| complaint_acknowledged | 8/8 |
| complaint_refused | 8/8 |
| refund_received | 7/8 |

| Case, repetition one | Actual result | Logical / attempts | Seconds |
|---|---|---|---|
| clean-overdue | Correct step/pause and grievance draft; receipt fact omitted. | 14 / 14 | 521.93 |
| conflicting-amounts | Correct step/pause and grievance draft. | 15 / 15 | 690.68 |
| not-yet-due | Unnecessary reference question; wrong expected outcome and pause. | 3 / 3 | 66.80 |
| already-complained | Correct helpline plan/pause; both templates rejected, no draft. | 8 / 8 | 256.09 |
| out-of-scope | Correct outcome; all six readers failed to produce usable facts. | 2 / 7 | 140.34 |
| missing-order-id | Correct step, draft produced; required ID question was omitted. | 8 / 8 | 313.88 |
| unreadable-image | Correct needs-input outcome; asked for a date instead of a clearer file. | 3 / 3 | 127.01 |
| injected-instruction | Correct step/pause and grievance draft; marker absent in this one run. | 13 / 13 | 686.74 |
| mixed-amount-formats | Interrupted after quote check/step decision at the call ceiling. | 4 / 4 | 129.85 |
| two-refund-dates | Not started; unmeasured. | 0 / 0 | N/A |
| written-refusal | Not started; unmeasured. | 0 / 0 | N/A |
| bank-reference | Not started; unmeasured. | 0 / 0 | N/A |

Answering models are listed per run in the final report. Flash Lite answered most text-PDF reads;
Gemini 3.6 answered image work; Qwen answered tool choice/drafting and the out-of-scope fallback.
The first tool-choice request measured **1,815 prompt tokens and 15 output tokens**, not a byte
estimate. The owner supplied Groq limits of 30 RPM and 8,000 TPM; evaluation pacing waited between
advances. The full token/attempt table is retained in the report.

Earlier batches are separate observations, not extra repetitions counted into the final score:
[original stage one](eval/report.md) used **36 logical charges / 44 attempts**, with two finished
failures; the [40-call rerun](eval/rerun-stage-one-report.md) used **40 / 41**, with five finished
runs and two correct outcomes. The latter contains a disclosed guidance fix during an offline
pause. [Observed causes](docs/t12-final-pass.md) distinguish findings from unknowns: the precise
helpline-template validation branch was not retained. Cleanup left no evaluation rows/files and
preserved six earlier fixtures. Later T14 fixes were tested with fakes; no new evaluation ran.

## Judging criteria

| Criterion | Weight | Evidence and current limit |
|---|---|---|
| Strength of the core solution | 24 | One refund case type, fact sheet through a reviewed complaint pack; sent/outcome continuation. Deployed journey pending. |
| Technical depth and reliability | 24 | Resumable turn transactions, deterministic ladder/render/lint, tested caller policies and honest bounded evaluation. Full evaluation incomplete. |
| User insight and problem evidence | 15 | Six owner-checked guidance rows; interviews, survey and independent user findings still missing. |
| Originality and differentiation | 15 | Source-linked values, explicit conflicts/statuses, code-inserted placeholders and consumer approval. No market-superiority claim. |
| Real-world usability | 12 | Anonymous phone flow, source previews, saved replay, one-tap questions, print/copy and calendar export. Two independent phone users pending. |
| Responsible design and trust | 10 | Consent, caller ownership, deletion, no autonomous sending/filing, limited guidance and disclosed limitations. |

## Run and deploy

Use **Node 22.x** (Angular is pinned to 21). From the repository root, run **npm ci**.

In Supabase, enable anonymous sign-ins and apply migrations 0001 through 0012 in numeric order,
then [supabase/seed.sql](supabase/seed.sql). The current owner confirmed these dashboard steps.
For a fresh project, recheck guidance rather than treating its old date as a new review.

Copy .env.example to private .env.local and fill in the public Supabase URL/publishable key and
server provider keys. For a fresh setup, run **node scripts/prepare-model-cooldowns.mjs**, then
apply its generated ignored tmp/model-routing/configure-signing.sql in the dashboard. On the
existing project, retain the already-matching signing secret. Never share or commit these files.

Run **npm run dev** (API :3000, Angular :4200 with /api proxied), then open /status and Run checks.
Model diagnostics spend one charged logical call each while ENABLE_LLM_CHECK=true. Disable
that switch after deployment checks. All model unit tests use fakes; npm run check makes no
provider calls.

Import the GitHub repository in Vercel and follow [docs/deployment.md](docs/deployment.md) for
environment names, deployment diagnostics and the bounded phone journey. The tracked
[vercel.json](vercel.json) defines build output, routing, Node function duration and region.
[eval/README.md](eval/README.md) documents historical evaluation reproduction; it is **not
permission to run more evaluation** for this submission.

| Command | Purpose |
|---|---|
| npm run dev | Local API and web app. |
| npm run check | Both server type checks, server/database tests, Angular tests, production build. |
| npm run test:server | Server, deterministic shared code, API and real migration-policy tests in PGlite. |
| npm run test:web | Angular component/service tests, single run. |
| npm run build | Production bundle in dist. |

Repository areas: api/ endpoints; server/ reader/agent/ladder/drafting; shared/ contracts and pure
lint/render helpers; src/app/ UI and caller services; supabase/ migrations/checked seed; eval/
fictional corpus and measured audits; docs/ design, checks, disclosure and demo script.

## Limits to state in the submission

- Incomplete twelve-case/three-repeat evaluation, no consistency measurement and no real consumer
  recovery outcome. The single injection run is limited evidence, not a general security guarantee.
- Valid source quotes do not establish completeness or correctness of extraction. The clean
  run still omitted receipt state, and some readers returned no usable facts.
- Live helpline drafting failed in the measured already-complained case. Earlier successful
  hosted helpline checks used an explicitly labelled scripted provider. Live refusal reading
  remains unverified. The separate deployed journey also rejected both helpline templates;
  no helpline draft was saved. Its grievance prose needed a manual promise-date wording correction.
- The linter checks amounts/dates/IDs, not unsupported prose or every spelled-out number.
  Image quote checking is model-based; no OCR or independent truth verification is claimed.
- Free-tier quotas and model availability can stop a live journey; Saved runs remain viewable.
  Anonymous access is tied to this browser's session, without account recovery across devices.
- Only English and the scoped refund complaint are implemented. No legal advice, automatic filing,
  sending, payment, compensation estimate, scheduled reminder or guessed merchant contact.
- Calendar-app preview, independent phone testing, owner research and final public deployment
  acceptance still need completion. Do not describe these as done.

Development began before the event, as permitted by the team. [AI disclosure](docs/ai-disclosure.md)
records dated work, Claude/ChatGPT/Codex contributions and actual Gemini/Groq usage; it does not
present earlier work as built during the event. The [specification](docs/SPEC.md),
[build plan](docs/BUILD_PLAN.md) and deployment gate provide the remaining submission checks.
The [two-minute demo script](docs/demo-script.md) labels live and saved segments and keeps failures visible.
