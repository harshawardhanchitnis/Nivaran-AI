# Disclosure: prior work and AI tools

WCC Launchpad 30 requires earlier code and templates, and significant AI tools, to be disclosed.
This file is that disclosure. Keep it accurate; update it whenever either list changes.

## Work that existed before the event started (4 October 2026, 10:00 IST)

Prepared on 2 October 2026 as a starter template. None of the product's core workflow is in it.

| Area | What existed |
|---|---|
| Project scaffold | Angular 21 app generated with the Angular CLI, Angular Material, routing with placeholder screens, build and test configuration. |
| Plumbing | Supabase browser client with anonymous sign-in, an `/api` client, a route guard, a local API dev server, environment handling, `vercel.json`. |
| Infrastructure endpoints | `api/health`, `api/whoami`, `api/llm-check`, used only by the `/status` diagnostics page. Codex added usage charging to model diagnostics on 2 October 2026. |
| Server helpers | JSON and error helpers, token verification, model provider handles (no prompts, no agent). |
| Shared contract | Fact field names and statuses, upload limits, ladder step names, API and database row types. |
| Database | `supabase/migrations/0001_init.sql`: tables, row-level security, storage rules, usage-limit function; plus tests for those rules. |
| Documents | `docs/SPEC.md`, `docs/BUILD_PLAN.md`, `AGENTS.md`, this file. |

Not in the starter, and reserved for implementation during the event: document reading,
verification, the agent loop and its tools, the escalation ladder, drafting and the linter, the
evaluation set, and every product screen. These have not been built as of 2 October 2026.

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
deployed checks remain pending; core product work has not started.

<!-- Team: add anything else prepared before the start (guidance snippets, synthetic test
     documents, interview notes) and the date it was prepared. Delete this comment when done. -->

## AI tools used

| Tool | Used for |
|---|---|
| Claude (Anthropic), via Claude Code | Reading the brief, comparing project options, writing the specification, building the starter template above. |
| ChatGPT (OpenAI) | Independent review of the project options and the specification. |
| Codex (OpenAI) | Pre-event handover review, starter checks, local setup preparation, a diagnostic usage-charging fix and browser diagnostics through the computer-use plugin on 2 October 2026. Core product coding has not started. |
| Google Gemini API | One pre-event setup diagnostic on 2 October 2026. Intended product use: reads documents and drives the agent; that workflow is not built yet. |
| Groq API | One pre-event setup diagnostic on 2 October 2026. Intended product use: fallback model; that workflow is not built yet. |

<!-- Team: add any other tool that made a significant contribution (for example a design or
     video tool), and correct anything above that does not match what you actually used. -->

## Research done before the event

<!-- Team: list interviews, the survey, and the primary sources read for the guidance snippets,
     with dates. The rules allow research before the event; state it anyway. -->
