# Nivaran AI

An agent that turns scattered refund evidence into a source-linked fact sheet, a next step with
dates, and a complaint pack the consumer reviews and sends themselves.

Built for WCC Launchpad 30, Track 1 (Agentic AI).

> **Status: build in progress.** Case creation, private document uploads and My cases are connected.
> `/demo` shows the presentational case screen with invented sample data. The document-reading
> server passed hosted PDF and image reading checks. The real case screen now restores saved
> readings and opens private image and PDF-page previews with quotes. Code normalisation and
> quote checks and atomic fact persistence passed unit and hosted fixture checks. The investigating
> loop has eight validated tools, saved state, questions and a step limit, tested with scripted models.
> Stored questions, one-tap/text answers and the real activity log are connected; answering resumes
> without reloading. The pure refund ladder and date arithmetic are connected to `get_next_step`.
> Saved plans now show code decisions, checked sources and dates in the existing screen, with
> atomic approve, request-change and reject actions. Approved complaint steps now have placeholder
> drafting, shared edit checks and a printable pack using the existing complaint component.
> Scripted hosted saves, edit privacy, copy and browser PDF output have passed checks. Live model
> drafting and the deployed journey remain unverified. Sent-date recording and a local calendar
> download pass hosted and browser checks; a calendar-app preview is awaiting the owner.
> Outcome recording now recomputes the ladder, waits after acknowledgement, resolves a received
> refund, or reads an uploaded refusal. A scripted no-reply continuation produced a helpline pack.
> The full live evaluation remains pending.
> See `docs/ai-disclosure.md` for dates and checks.

Model calls use configurable vision and text lineups in `.env.example`. PDF pages with text are
extracted locally; scanned or mixed PDFs use vision, and Groq never receives PDF file bytes.
Each logical call is charged once, with immediate provider failover and signed database cooldowns.
Apply migrations in order through `0010_case_outcomes.sql`, apply the owner-checked `supabase/seed.sql`, run
`node scripts/prepare-model-cooldowns.mjs`, then apply its ignored setup SQL in the dashboard.
Keep `MODEL_COOLDOWN_SIGNING_SECRET` server-only; add that local setting to Vercel when deploying.
Current owner-reported Gemini daily limits support conservative app caps of 15 per user and 15
globally. The supplied reading benchmark and bounded live routing results are in
[eval/model-benchmark.md](eval/model-benchmark.md); they are not the full product evaluation.
The six guidance rows were checked by the owner on 2 October 2026; review details are in
[docs/guidance-review.md](docs/guidance-review.md). Complaint response dates use the recorded sent
date; rule 4(5) counts from receipt, so the plan explicitly says to adjust for later receipt.

## Documents

| File | What it is |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | What we are building, and what we are not. |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | The order of work, with checks for each task. |
| [AGENTS.md](AGENTS.md) | Rules and conventions for anyone (or any AI tool) writing code here. |
| [docs/ai-disclosure.md](docs/ai-disclosure.md) | Prior work and AI tools, as the hackathon rules require. |
| [docs/problem-evidence.md](docs/problem-evidence.md) | Interviews, survey and public data. |

## Stack

Angular 21 and Angular Material, hosted on Vercel. Vercel Functions (Node, TypeScript) for anything
that needs the model key. Supabase for sign-in, Postgres with row-level security, and private file
storage. Task-routed Gemini and Groq lineups through the AI SDK.

## Set up

You need Node 22 and a Supabase project.

1. Install packages:

   ```bash
   npm install
   ```

2. In Supabase: run every file in `supabase/migrations/` in numeric order, through `0010`.
   They add caller-owned reading/investigation transactions, signed model availability and
   daily caps of 15 logical calls per user and 15 globally, plan review, draft saves, sent dates
   and outcome continuation.
   Apply `supabase/seed.sql` for the owner-checked guidance. Review caps against your provider limits.
   Turn on anonymous sign-ins (Authentication > Sign In / Providers).

3. Copy `.env.example` to `.env.local` and fill it in. Run
   `node scripts/prepare-model-cooldowns.mjs`, then apply the generated private setup SQL in
   Supabase SQL Editor. Do not commit or share that file or `.env.local`.

4. Start the API and the app together:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:4200/status` and press **Run checks**. Every check should pass.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local API server on port 3000 and the app on port 4200. |
| `npm run check` | Type-checks, all tests and a production build. Run before every commit. |
| `npm run test:server` | Server, shared and database policy tests. |
| `npm run test:web` | Angular unit tests. |
| `npm run build` | Production build into `dist/`. |

## Layout

```
api/                 Vercel Functions. Endpoint files only.
server/              Code the functions import: HTTP helpers, auth, database client, model handles.
shared/              The contract used by browser and server: facts, limits, API and row types.
src/app/core/        Supabase client, API client, route guard.
src/app/features/    One folder per screen.
supabase/migrations/ Tables, row-level security, storage rules, usage limits.
tests/               Server, API and database policy tests.
scripts/             Local API server and environment file generator.
docs/                Specification, build plan, disclosure, problem evidence.
```

## Deploy

Import the repository in Vercel, add the variables from `.env.example` under Settings >
Environment Variables, and deploy. `vercel.json` sets the build, the Mumbai region and the
single-page-app rewrite. Then open `/status` on the deployed URL.

## Security model in one paragraph

Every row belongs to one user and row-level security is on for every table. The functions act with
the caller's own token and there is no service-role key in the project, so the agent can only ever
touch the signed-in user's rows. Guidance text and usage counters cannot be written through the
API. Evidence files are private to their owner. `tests/db/policies.test.ts` runs the real migration
against an in-process Postgres and checks each of these rules.
