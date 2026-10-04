# Deployment handoff and submission gate

Status on 4 October 2026: local implementation through T15 passes checks. No Git remote or
public Vercel URL is configured in this checkout. Deployment acceptance has not passed.
The owner performs Vercel environment configuration and dashboard SQL under the handover.
No further corpus evaluation is authorised.

## What the owner needs to provide

1. The GitHub repository URL to receive this checkout, or confirmation that it has already
   been pushed. The agent can push once the destination is supplied and credentials work.
2. Import that repository into Vercel and configure the variables below, then send the
   public deployment URL. Keep API keys and the signing secret out of chat.
3. Confirm the final evaluation caps have been restored using eval/restore-caps.sql.

## Deploy from this repository

- Project root: the repository root; framework: Angular.
- Node: 22.x. vercel.json already supplies npm ci, npm run build, dist output, the SPA rewrite,
  Mumbai region bom1 and a 60-second function duration. Keep these repository settings.
- All migrations through 0012 and the six checked seed rows have been applied to the current
  Supabase project, as confirmed by the owner. Anonymous sign-ins are enabled.
- Add the following names to Vercel's Production environment. Copy values directly from the
  private local .env.local; do not upload or commit that file.

| Variable | Purpose |
|---|---|
| SUPABASE_URL | Existing Supabase project URL; compiled into the browser. |
| SUPABASE_PUBLISHABLE_KEY | Publishable key; compiled into the browser. |
| GOOGLE_GENERATIVE_AI_API_KEY | Server-only Google provider key. |
| GROQ_API_KEY | Server-only Groq provider key. |
| MODEL_COOLDOWN_SIGNING_SECRET | Existing server-only secret matching the dashboard signing configuration. |
| ENABLE_LLM_CHECK | true only for initial deployment diagnostics; false afterwards. |
| LLM_VISION_LINEUP | Optional; use the existing value/default in .env.example. |
| LLM_TEXT_LINEUP | Optional; Qwen first for tool choice and drafting. |
| LLM_PDF_TEXT_READING_LINEUP | Optional; Gemini first for text-PDF reading. |
| LLM_ATTEMPT_TIMEOUT_MS | Optional; 8000 default. |

API_PORT and EVAL_GROQ_TPM/EVAL_GROQ_RPM are local tooling settings; they are unnecessary on Vercel.
Never add a Supabase service-role or secret key. For this existing project, copy the existing
cooldown signing secret; generating a different one without applying matching dashboard SQL
would invalidate signed availability receipts.

Deploy, then share the public URL. If it fails, collect the first relevant build/function error
without environment values. Check the actual logs before changing imports, build settings or
regions. Environment edits require another deployment to take effect.

## Bounded deployed acceptance, after the URL works

This is a single deployed journey check, not another evaluation pass. Use synthetic documents
only and a fresh anonymous session on the deployment origin. If quota is exhausted, the owner
can apply deploy/raise-smoke-caps.sql once. It grants at most fifteen additional logical calls
globally on the current India date, retaining counters; the per-user cap stays fifteen. Record
the initial budget and stop at its fifteen-call ceiling even if the journey is unfinished.
Apply eval/restore-caps.sql immediately after finishing or stopping. Do not leave the temporary
global setting in place for submission or the next day.

1. /status: Run checks. All six infrastructure checks must pass; health must report bom1.
   Test vision and text lineups once each (two logical calls in total; fallback attempts share
   their call). Report the actual models/errors. Set ENABLE_LLM_CHECK=false and redeploy.
2. At 360 px, start one fictional case using conflicting-amounts/invoice.pdf, refund.pdf and
   second-refund.pdf, plus clean-overdue/customer-status.pdf. All four refer to the same fictional
   order MM260901. Consent,
   upload, read the facts, answer the amount conflict and any required gap, and open a quote
   with its actual source page. Leave/reopen once to check saved progress.
3. Review the plan's checked rule links and receipt-date caveat; approve and generate a draft.
   Type FAKE123456 and show the linter flag. Remove it, save, open the pack, copy text and print.
4. Record a synthetic sent date old enough to exercise no reply (clearly a test). Record no
   reply, inspect the helpline step and approve its text. Retain the same facts/evidence.
5. My cases: cancel deletion once, then confirm deletion of this disposable case. Verify
   its exact storage prefix and all nine case tables are empty through the caller's client.
6. Open all five Saved runs without calling advance or draft. Check source pages and visible
   failure labels. A recorded decision uses 2 October; a new live decision uses today's India date.
7. Check the quota message with exhausted quota and verify the case/saved replay stays usable.
   Inspect console errors, overflow and WCAG A/AA checks on the visited screens. Restore caps.

If a required step fails or the budget stops, record that failure and fix it; never describe
the deployed journey as passed from a scripted local fixture or a Saved run.

## Gate evidence

| Handover requirement | Current result | Evidence / remaining action |
|---|---|---|
| Full check green; clean working tree | Local pass after T17 commit | 430 server/database + 94 Angular tests, both type checks, production build; inspect git status again before push. |
| Deployed /status; bom1; diagnostic switch off | Pending | Owner must deploy and provide the URL; check then redeploy with ENABLE_LLM_CHECK=false. |
| Real deployed phone journey through helpline text and delete | Pending | Follow the bounded journey above; local scripted checks are separate. |
| Five saved samples, no model calls | Local pass; deployed pending | docs/t13-checks.md; static saved audits and documents. |
| Quota failure remains usable | Local pass; deployed pending | Unit checks and the exhausted local Saved run; check the deployed message. |
| 360 px, no console errors | Visited local views passed; deployed pending | docs/t13-checks.md, docs/t15-checks.md, earlier task checks; inspect all deployed journey screens. |
| No secret in Git or browser bundle | Local pass; recheck before push | No tracked plausible key-prefix matches; exact server-secret scan found none in tracked files or 55 dist files. Browser environment contains only URL/publishable key. |
| Report and exact README numbers | T16 local documentation | Final measured revision 3906f5b; full three-repeat evaluation incomplete. |
| README, disclosure, problem evidence complete and truthful | Owner research missing | Missing interview/survey results are explicitly recorded; never invent them. |

Owner checks still outstanding: deferred calendar-app preview, two independent phone users,
actual research findings, recording the demo video and submission. Aim to submit by 13:00 IST
on 5 October, before the 14:00 deadline. Do not change the deployment after submission.

Official hosting references: [Node function runtime](https://vercel.com/docs/functions/runtimes/node-js),
[function limitations](https://vercel.com/docs/functions/limitations),
[environment variables](https://vercel.com/docs/environment-variables).
