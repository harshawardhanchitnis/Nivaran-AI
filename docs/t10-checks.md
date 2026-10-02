# T10 local checks — 2 October 2026

Sent-date recording and the downloaded calendar file have run with the hosted, scripted T8/T9
fixture. These are implementation checks, not a real complaint or live-model evaluation.
The owner's calendar-app preview is still pending. On 2 October the owner explicitly deferred
that check and authorised continuing with T11 and later tasks. T10's preview acceptance check
remains unverified.

- The owner confirmed applying the entire `0009_mark_sent.sql` in Supabase SQL Editor.
- Forty-six database policy/seed tests include caller ownership, visitor denial, approval and
  saved-draft requirements, invalid future dates, atomic case/fact/plan/event updates, January
  month-end clamping, identical-date replay and explicit corrections.
- Server tests check strict real dates, India-today bounds, authentication, the caller transaction
  and plain recoverable errors without leaking database details. The browser service records a
  date without starting or advancing investigation.
  Wait plans also offer their refund due date as a local calendar file without preparing a draft.
- Calendar tests cover all-day dates, stable IDs, exclusive next-day ends, year-end rollover,
  control-character escaping, UTF-8 folding without splitting characters, invalid dates and the
  receipt caveat. The export has no attendees or alarms.
- In the pack at 360 px, recording 1 October 2026 saved `plans.sent_on`, a confirmed user
  statement for `complaint_sent_date`, case status `sent`, and an honest activity event. The
  stored and displayed deadlines were 3 October and 1 November. The visible receipt caveat
  explains that rule 4(5) counts from receipt while these dates use the recorded sent date.
- The browser's download-event waiter timed out, but the actual file was found at
  `C:/Users/HARSH/Downloads/nivaran-refund-dates.ics`. Its three all-day start dates match the
  stored plan: refund due 24 September, acknowledgement due 3 October, resolution due 1 November.
  A copy and the row audit are in ignored `tmp/t10/`; the sent-panel screenshot is
  `tmp/t10/sent-phone.png`. Opening in a calendar app has not yet been confirmed.
- The pack's document width was 345 px within its 360 px viewport. Axe reported zero WCAG A/AA
  violations and zero incomplete checks; there were no console warnings or errors.
- Provider calls: **zero**. The hosted daily counter remained at fifteen. No provider attempt or
  quota increase was needed for this feature.

Full check: both server type-checks, 334 server/database tests, 83 Angular tests and the production
build. Deployment and the full deployed journey remain pending alongside the later tasks.
