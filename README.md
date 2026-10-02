# Nivaran AI

An agent that turns scattered refund evidence into a source-linked fact sheet, a next step with
dates, and a complaint pack the consumer reviews and sends themselves.

Built for WCC Launchpad 30, Track 1 (Agentic AI).

> **Status: starter template.** The product workflow is not built yet. What exists is the project
> skeleton, the database with its security rules, and a `/status` page that proves the setup.
> See `docs/ai-disclosure.md` for exactly what was prepared before the event.

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
storage. Gemini on the free tier as the primary model, Groq as the fallback, through the AI SDK.

## Set up

You need Node 22 and a Supabase project.

1. Install packages:

   ```bash
   npm install
   ```

2. In Supabase: run `supabase/migrations/0001_init.sql` in the SQL Editor, then turn on anonymous
   sign-ins (Authentication > Sign In / Providers).

3. Copy `.env.example` to `.env.local` and fill it in.

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
