# T9 local checks — 2 October 2026

These are implementation checks with scripted templates and synthetic data, not product
evaluation results or a successful live-model complaint journey. No provider call was made for T9.

`npm run check` passed both server type-checks, 318 server/database tests, 79 Angular tests and
the production build.

- Renderer tests reject unknown/unavailable/malformed placeholders, render source-labelled
  amounts, IDs and dates, and preserve local personal placeholders. A calculated working-assumption
  due date uses its cancellation source. Existing labelled spans survive ordinary edits; a made-up
  value with a copied evidence label is still flagged.
- Shared linter tests catch seeded amounts, dates and IDs, negative amounts, excess decimal places,
  invalid dates and partial IDs. Normalised fact values, all-numeric known IDs and computed dates
  are accepted. Amounts in words and prose claims are a stated limitation.
- Fake-provider tests cover approval, steps zero/three, duplicate calls, concurrent claims,
  repair once, charge failure, no tools/SDK retries, actual answering-model records and the enclosing
  request deadline. Unit tests never contact a model.
- Forty-two database policy/seed tests include the new draft transactions: caller ownership,
  claim exclusivity, token matching, expired claim recovery, approval requirements and versioned
  saves. The owner confirmed applying migration 0008 in the hosted SQL Editor.
- A scripted template was saved for the approved overdue T8 fixture through the real caller-scoped
  transaction. The actual draft API replay returned that same saved version with HTTP 200 and
  no generation. A browser edit produced version two, retained personal placeholders, and stored
  `TX99887766` as an explicitly accepted user statement. The event and run identify the scripted
  generator as `scripted-test-no-provider`; it is not a live model result.
- At 360 px, typing `TX99887766` visibly flagged it. Keep-as-statement removed the flag and
  added the source label. Copy included locally entered synthetic personal details and source
  labels without remaining placeholders. The database audit found none of those personal details
  in either version. Private fields clear when leaving the page; they are not persisted.
- The pack had a document width of 345 px within the 360 px viewport, no console warnings/errors,
  and zero axe violations or incomplete checks. A two-page browser-generated A4 PDF included the
  complaint, timeline, evidence index and checked-source URL, hid the editing controls, and was
  rendered and visually inspected with Poppler. This fixture has no uploaded documents; the
  populated evidence index is also covered with component data, alongside the earlier T3 source checks.
- The hosted daily usage counter was fifteen both before and after the scripted save, API replay,
  edit and copy checks. Live drafting has not been run because the configured fifteen-call cap
  is already reached. Deployment and its full journey are still pending.
