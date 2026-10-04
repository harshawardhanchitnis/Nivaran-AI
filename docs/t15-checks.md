# T15: delete a case and its files

My cases now offers a confirmation dialog explaining permanent deletion. Keep case is focused
first; cancellation restores focus to the original button. Confirming calls an authenticated
endpoint acting as the same user, never an agent tool or an administrator.

The server checks ownership and a recent active processing claim, enumerates the exact private
case prefix (including uploads whose row insertion failed), validates every path, removes files,
checks that the prefix is empty, and only then deletes the case. Children cascade. A failure keeps
the remaining records and offers retry; deletion of an already absent case is replay-safe. It does
not disclose or touch another user's case. No database migration was needed.

The hosted disposable fixture contained two storage objects and rows in all nine case tables.
Its clearer-file resume was called twice using the actual 0012 RPC: phase became reading, turn
stayed at one on replay, and the existing three agent steps were retained. This check invoked no
advance or provider. The fixture was repaired after its initial document insert failed; no second
case was created.

In the browser at 360 px, cancelling kept the fixture; confirming removed it and announced
“The case, files and records were deleted.” Focus moved to My cases. Caller-scoped queries then
found zero rows in cases, documents, evidence_items, case_facts, agent_runs, agent_events,
questions, plans and drafts, and zero objects in its storage prefix. The six earlier fixtures
remained. The 4 October usage counter stayed at 100. Screenshots are in docs/screenshots.

The finished list had no axe A/AA violations or incomplete checks, no horizontal overflow
(viewport and scroll width both 360), and no console warnings/errors. The dialog had zero axe
violations; its incomplete contrast/focus checks were inspected manually. The warning text uses
rgb(85,91,112) on rgb(247,245,240), a 6.18:1 contrast ratio. Tab from the final button returned to
Keep case; cancellation returned focus to the opener. Material's hidden focus-trap anchors and
the hidden background explain the focus checks requiring manual review. A true 360 px browser
viewport also showed no dialog overflow.

Local validation: npm run check passed both server type checks, 430 server/database tests,
94 Angular tests and the production build. Tests cover file-before-row ordering, orphan uploads,
pagination, owner/path boundaries, active claims, retries, confirmation/cancellation, failure
messages and cascades with an unrelated case retained. Model calls used: zero.

The deployed HTTP/browser journey remains pending the Vercel deployment gate.
