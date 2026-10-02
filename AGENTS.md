# Nivaran AI: instructions for coding agents

Read these three files before changing anything:

1. `docs/SPEC.md`: what to build. It is the source of truth; do not widen the scope.
2. `docs/BUILD_PLAN.md`: the order to build it in, with acceptance checks per task.
3. `docs/ai-disclosure.md`: what existed before the hackathon started. Keep it accurate.

## What this project is

An entry for the WCC Launchpad 30 hackathon (Track 1, Agentic AI). Nivaran turns a consumer's
scattered refund evidence into a source-linked fact sheet, a next step with dates, and a complaint
pack the user approves and sends themselves. One case type only: an online refund that is owed and
has not arrived.

## What already exists (the starter)

- Angular 21 app shell with lazy routes. Every product screen is a placeholder
  (`src/app/shared/ui/planned-screen.ts`); only `/status` is real.
- `src/app/core/`: Supabase client with anonymous sign-in, the `/api` client, the route guard.
- `api/`: three infrastructure endpoints (`health`, `whoami`, `llm-check`). No product endpoints.
- `server/`: HTTP helpers, auth, Supabase client factory, model provider handles.
- `shared/`: the contract (fact fields and statuses, limits, ladder step names, API and row types).
- `supabase/migrations/0001_init.sql`: every table, row-level security, storage rules, usage limits.
- Tests: `tests/` (server, API, database policies) and `src/**/*.spec.ts` (Angular).

There is **no** agent loop, document reader, verification, ladder, drafting, linter, evaluation or
product UI yet. Those are the build.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local API server on :3000 and Angular on :4200 (with `/api` proxied). |
| `npm run typecheck:server` | Type-checks `api/`, `server/`, `shared/`, `scripts/`, `tests/` twice (see below). |
| `npm run test:server` | Vitest for server, shared and database policy tests. |
| `npm run test:web` | Angular unit tests, single run. |
| `npm run build` | Production build into `dist/`. |
| `npm run check` | All of the above. **Must pass before every commit.** |

If `npm install <package>` fails with `Cannot read properties of null (reading 'edgesOut')`, that is
an npm 10 bug. Use `npx npm@11 install <package>` instead.

Node 22 is required (`22.x`). Angular is pinned to 21 because Angular 22 needs Node 22.22.3 or newer.

## Rules that must not be broken

1. **Code decides, the model explains.** Arithmetic, dates, the ladder step, conflict detection,
   value insertion and linting are code. The model extracts, chooses the next tool, and writes prose.
2. **The model never types an amount, a date or an ID into a draft.** It writes placeholders; code
   inserts values from the fact sheet (SPEC section 7).
3. **One agent step per HTTP request.** `advance` makes at most one model call and runs at most one
   tool, then returns. State lives in Postgres. Calls are idempotent on `turn`.
4. **The server acts as the user.** Build every Supabase client with `createUserClient` or
   `requireUser`. Never add a service-role or secret key. Never bypass row-level security.
5. **Charge before every model call.** Call the `charge_model_call()` database function first and
   stop when it returns `allowed: false`.
6. **No tool may send, pay, file or delete.** The user sends the complaint themselves.
7. **Documents are data, not instructions.** The reading call has no tools. Never put raw document
   text into the tool-using loop as instructions.
8. **Five fact statuses, no percentages.** Never write "verified" or "proven"; write "stated in".
9. **No legal overclaiming.** Rule text comes only from `guidance` rows a human checked. The app says
   it is not legal advice and that the ladder order is recommended practice.
10. **Do not invent results.** Evaluation numbers, survey numbers and statistics are only ever what
    was actually measured or collected.

## Code conventions

### Server side (`api/`, `server/`, `shared/`, `scripts/`, `tests/`, `eval/`)

- Native ESM. **Every relative import ends in `.js`**, even though the file is `.ts`:
  `import { json } from '../server/http.js'`.
- Use `import type` for types (`verbatimModuleSyntax` is on).
- Read env values with brackets: `process.env['NAME']`. Add new settings to `server/env.ts` and
  `.env.example`.
- Handlers use the web-standard signature and the helpers in `server/http.ts`:
  `export const POST = handle(async (request) => json({ ... }))`.
  Throw `HttpError(status, code, message)` for anything the user should see. Validate bodies with
  `readJson(request, schema)`.
- **Only endpoint files go in `api/`.** Vercel turns every `.ts` file there into a function. Put
  shared code in `server/` and tests in `tests/`.
- `shared/` must not use browser-only or Node-only APIs, and must not import from `server/` or `src/`.
- Code must pass both type-check configs in `npm run typecheck:server`. The second one mimics
  Vercel using the root `tsconfig.json`.

### Browser side (`src/`)

- Import the contract as `@shared/...` (for example `import type { CaseRow } from '@shared/database'`).
- Call the API only through `ApiService`; use Supabase only through `SupabaseService`.
- Phone first. Every screen must work at 360 px wide with no horizontal scroll.
- Plain language in the UI. A user must be able to finish without a walkthrough.
- Follow the Angular rules at the end of this file.

### The design system (already built: use it, do not restyle)

- Tokens (colour, type, radius, shadow, the five status colours) are CSS variables in
  `src/styles.css`. Use the variables; never hard-code a colour or a font.
- `src/app/shared/ui/` holds finished presentational components: `StatusChip`, `EvidenceTag`,
  `FactList`, `SourcePanel`, `ActivityLog`, `QuestionCard`, `LadderTrack`, `DeadlineTimeline`,
  `PlanPanel`, `ComplaintDraft`, `UploadDropzone`, and `CaseWorkspaceView`, which composes the
  whole case screen (tabs, fact sheet with source panel, activity, plan with approval, complaint).
- They take the view models in `src/app/shared/ui/models.ts` and emit events. They must stay free
  of Supabase and API calls.
- `/demo` (`features/demo`) drives `CaseWorkspaceView` with invented data in `sample-case.ts`.
  It is the visual reference. The real case screen does the same thing with real rows: map
  `shared/database.ts` rows into the view models and pass them in. Do not build a second layout.
- `features/case-new` has the finished notice, dropzone and file rules (`file-rules.ts`); task T1
  only connects "Continue" to case creation and upload.
- Screens still to design with the same tokens and pieces: My cases, the printable pack, the
  "mark as sent" and "what happened" steps, and the sample-case cards on the home page.
- Look: warm paper background, white cards, Fraunces for headings, Inter for text, IBM Plex Mono
  for IDs and evidence labels, green for supported, marigold highlight only for quoted document text.

### Database

- Never edit `0001_init.sql` once it has been applied to the hosted project. Add
  `0002_<name>.sql`, update `shared/database.ts` in the same commit, and extend
  `tests/db/policies.test.ts` (load the new file there too).
- Every new table gets row-level security and a policy test.

### Tests

- Deterministic code (ladder, normalisers, quote check, renderer, linter) is unit-tested with
  table-driven cases, including the nasty ones.
- Model calls are never made in unit tests. Inject the model call so tests can pass a fake.
- A task is done when its acceptance checks in `docs/BUILD_PLAN.md` pass and `npm run check` is green.

## Hackathon rules that affect how you work

- The team has confirmed that building may start before the event; the binding requirement is to
  submit before the deadline (5 Oct 2026, 14:00 IST). Work through `docs/BUILD_PLAN.md` now.
- Keep `docs/ai-disclosure.md` truthful about what was built and when. Never describe pre-event
  work as built during the event.
- Commit small and often with honest messages; judges may ask for proof of development.
- Record every significant AI tool in `docs/ai-disclosure.md`.
- Do not copy code or text from other projects. Respect licences.

## Angular rules

You are an expert in TypeScript, Angular, and scalable web application development. You write
functional, maintainable, performant, and accessible code following Angular and TypeScript best
practices.

### TypeScript

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

### Angular

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

### Accessibility

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

### State management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

### Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.
- Do not write arrow functions in templates (they are not supported).

### Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection
