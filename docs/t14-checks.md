# T14: failure recovery and useful actions

Tool choice now receives only actions that can advance the current case. Open conflicts offer
`ask_user`; the initial choices request the code decision or stop outside scope. Missing complaint
facts (merchant, order ID, refund amount, receipt state) are addressed before a drafting plan.
An unreadable file requests a clearer copy. Once the code-required checked guidance is loaded,
only proposing the plan is offered, preventing differently worded searches for the same rule.
The pure ladder order, immediate provider fallback and one-call/one-tool request rules remain.

Regression tests replay the exact saved not-yet-due, missing-ID, clean receipt omission,
unreadable-image and repeated injection-case searches. These are fake/offline checks after the
measured revision; no accuracy improvement is claimed without measurement. No further evaluation
has run. The final report remains unchanged.

Migration 0012 resumes a caller-owned document-request or failed run with a newly uploaded pending
file. It locks the case/run, rejects an active claim, answers the actual file question, preserves
agent_steps, adds one event, and is replay-safe even after reading the new file. Earlier files and
facts remain. The browser requires consent, retains a saved file on resume failure, and detects a
pending upload when reopening. The existing six-file/5 MB limits still apply.

Existing reading-loop tests cover transient cooldown waits, unchanged turns, stale concurrent
requests, network errors and leaving/reopening. Daily user/global caps produce plain API errors
without changing saved rows. Source links can be retried, and failed draft generation leaves the
approved plan available. Saved runs remain available while quota is exhausted.

Local check: 419 server/database tests, 92 Angular tests, both type checks and production build.
The owner applied the read-only quota migration 0011; replay correctly hides Run it live with
today's exhausted quota. The owner applied migration 0012. A hosted disposable fixture resumed
reading through the actual RPC twice: turn one on both calls, the existing three agent steps
retained, and no provider call. The fixture and files were then deleted through the T15 UI;
see docs/t15-checks.md. The deployed upload-to-recovery journey remains pending. The exact
invalid-template cause from the measured helpline run remains unknown because rejected output
was not retained.
