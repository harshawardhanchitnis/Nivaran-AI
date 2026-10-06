# Submission improvement build

The owner reported a three-day deadline extension on 6 October 2026 and confirmed that no
version had been submitted. The exact revised deadline time is not supplied. The previous
instruction to stop live corpus evaluation remains in force. This build uses fake providers
and offline serialization; no new model-quality or consumer-outcome result is claimed.

## Concrete causes and fixes

- Both rejected production helpline templates received the same generic repair prompt. The
  rejected strings were not retained, so their exact historical validation cause is unknown.
  Validation now returns safe codes for empty/oversized prose, literal digits, model-controlled
  date wording and unavailable placeholders. The repair gets the actual code. Logs contain
  attempt/model/code, never rejected prose or fact values. A successful repair saves its codes.
- The model controlled the chronology around a correctly inserted promise date. The production
  draft called 14 September a due date; the actual calculated due date was 24 September. Code
  now assembles promise-on, due-by and sent-on sentences. Model prose cannot request date or
  duration placeholders. Weekend and no-date assumption caveats remain explicit.
- There was no usable no-model draft recovery. After approval, the user can now explicitly
  choose a basic complaint. It uses usable merchant/order/refund/receipt facts, existing checked
  plan context and the same renderer, editor, linter and claim transaction. It invents no contact
  or legal prose, calls no provider, and identifies its code origin. An existing draft is returned
  idempotently; this choice does not overwrite it or automatically follow a failed generation.
  Approval saves the plan first; the user chooses the wording mode before any generation charge.
  Migration 0013 records this origin separately, leaves the last actual answering model on the
  run, and records no answering model on the code-only event. The old save RPC always replaced
  the run model, so this compatibility change is required before releasing basic recovery.
- The ladder decision and checked guidance retrieval were separate model-selected steps. The
  ladder tool now loads its required checked rows as part of its one tool result; the following
  request can propose the plan. Missing guidance still prevents an unsupported proposal.
- Case headers/list subtitles used cases.merchant_name, which can remain empty even when a
  merchant fact exists. Caller-scoped usable merchant facts now supply the display fallback.

## Interface and judge journey

The existing CaseWorkspaceView and tokens remain the layout. A next-action summary explains
the current gate and opens the proper tab. Blockers and required fields precede core facts;
other missing details remain expandable. Conflict choices show the exact matching checked
quotes, labels, pages and filenames. Document progress and retry countdown use saved state
and the returned cooldown. Desktop complaint editing sits beside its preview and identifies
unsaved edits, saved version and code-generated recovery. Home links directly to the recorded
conflict case and labels the illustrative still; guided invented data remains distinct.
The footer legal notice uses the darker existing text token after a local axe contrast failure.
The invented guided tour now uses the same basic renderer and actual editor/linter in page
memory, so reviewers can execute a made-up-ID check without quota. It requires answer,
approval and explicit preparation; uncertainty keeps the conflict open, and a chosen amount
is Your statement. Practice edits disappear on restart/navigation and never enter Supabase.

## Efficiency evidence and limits

The offline SDK request measurement is in tool-request-size-2026-10-06.json. For the historical
conflict snapshot the active tool set serializes to **5,014 bytes** including **630 schema bytes**.
The previous capture was **5,145 bytes / 1,127 schema bytes**. Context and prompt revisions differ;
this is a payload comparison, not a controlled token/latency benchmark. The full-tool payload in
this build is 7,420 bytes. Only ask_user is offered for this open conflict.

The model draft allowance is reduced from 2,200 to 1,400 output tokens because code supplies
the chronology. Groq telemetry can record responseMs across request and full body parsing;
runner waits happen before the request and are separate. No fresh provider timing was measured.
Historical elapsed run figures still include runner pacing. Saved metrics are unchanged.

## Remaining release checks

Local `npm run check` passed: **453 server/database tests (including 59 database policy tests),
126 Angular tests, both server type checks and production build**. Exact secret-value/prefix
scans of tracked/index/history files and the browser build found no secrets; `.env.local` stays
ignored. No provider call or live corpus evaluation was made for this build.

At 360 px, the saved conflict view and practice editor had no axe A/AA violations or incomplete
checks; Home and the open source sheet had no violations but retained incomplete gradient and
focus-anchor checks. Source-sheet Shift+Tab stayed inside; Escape restored Order ID focus.
The 1440 px practice review recheck had no violations or incomplete checks. Original scan data
is in accessibility-2026-10-06.json. These targeted checks are not a complete WCAG certification
or independent user study. Screenshots in screenshots/improved-* show local fictional views.

Repeat the release checks if further code changes are made, and inspect the public build after publication.
Apply 0013_draft_origin.sql before publishing the improvement build. It replaces only the
caller-scoped draft-save function, preserving its ownership, claim and changed-fact checks;
it adds no table and changes no cap or usage counter. No credential or cap increase is needed. Public model
draft recovery and refusal reading remain unverified until an explicitly approved bounded smoke
check; do not rerun the evaluation. Native calendar/print confirmation and independent phone
testing remain owner checks. The testing guide is user-testing-kit.md; no findings are invented.
