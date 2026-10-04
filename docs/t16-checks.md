# T16: judges' README and evidence record

The README now explains the scoped problem, product journey, architecture/security, task
routing, all six judging criteria, setup through migration 0012 and current limitations.
Its final scores are tied to measured revision 3906f5b. Historical batches remain separate;
the T14 guards receive no unmeasured accuracy credit. Full T12 acceptance and the deployed
journey are explicitly incomplete. Missing owner research is listed in problem-evidence.md.

An offline comparison matched all fourteen field rows and all nine measured run rows
(logical calls, attempts, seconds) against eval/final-stage-one-report.md. The summary retains
89/89 quotes, 7/8 outcomes, 5/8 exact pauses, 0/0 completed triples, 3/3 deterministic lint,
8/36 finished runs and 70 logical / 75 provider attempts. Three unstarted cases are N/A.
Model/token/fallback claims were compared with the same report. No live provider was called.

An exact-value scan checked all three existing server secrets against 363 tracked files and
55 production-browser files, finding no match. git grep for plausible Google, Groq and Supabase
secret key prefixes found no tracked match. The generated browser environment exposes only
the project URL and publishable key. This check does not replace Vercel environment review.

Deployment handoff documentation and an India-date, fifteen-additional-call smoke budget are
prepared. The owner must supply the GitHub destination, set Vercel variables, provide its public
URL and confirm final evaluation caps restored. The bounded deployed check is not another corpus
evaluation. No public deployment acceptance is claimed.

Full check before commit: 430 server/database tests, 94 Angular tests, both server type checks
and production build. Model calls used for T16: zero. T17 follows with the timed recording script.
