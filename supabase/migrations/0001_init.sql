-- =====================================================================================
-- Nivaran AI: tables, row-level security, storage rules and usage limits.
--
-- How to apply (fresh Supabase project, run once):
--   Dashboard > SQL Editor > paste this whole file > Run.
-- Then, in the dashboard:
--   Authentication > Sign In / Providers > turn on "Allow anonymous sign-ins".
--
-- Design rules this file enforces:
--   1. Every row belongs to one user. A user can only ever read or change their own rows.
--   2. Vercel Functions act with the caller's own token, so these policies also bind the agent.
--   3. Guidance text and usage counters cannot be written from the browser or the functions.
--
-- tests/db/policies.test.ts runs this file against an in-process Postgres and checks the rules.
-- =====================================================================================

-- ---------- helpers ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- cases -----------------------------------------------------------------------

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Untitled case',
  merchant_name text,
  status text not null default 'open'
    check (status in ('open', 'investigating', 'waiting_for_user', 'plan_ready',
                      'approved', 'sent', 'resolved', 'out_of_scope')),
  ladder_step smallint check (ladder_step between 0 and 3),
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cases_user_idx on public.cases (user_id, created_at desc);
create trigger cases_set_updated_at before update on public.cases
  for each row execute function public.set_updated_at();

-- True when the signed-in user owns the case. Runs as the caller, so row-level security on
-- public.cases applies inside it.
create or replace function public.owns_case(target_case uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.cases c
    where c.id = target_case and c.user_id = (select auth.uid())
  );
$$;

-- ---------- documents -------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,                       -- evidence label shown to the user: E01, E02, ...
  file_name text not null,
  storage_path text not null unique,         -- <user_id>/<case_id>/<document_id>-<file name>
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  sha256 text,
  doc_type text,                             -- what the reader thinks it is: invoice, refund_email, ...
  page_count integer,
  read_status text not null default 'pending'
    check (read_status in ('pending', 'read', 'unreadable', 'failed')),
  created_at timestamptz not null default now(),
  unique (case_id, label)
);
create index documents_case_idx on public.documents (case_id);

-- ---------- evidence_items: one observation = one value seen in one source ---------------

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('document', 'user')),
  document_id uuid references public.documents (id) on delete cascade,
  field text not null,
  value_text text not null,                  -- as written in the source
  value_norm jsonb,                          -- normalised by code: {"amount": 9999.00}, {"date": "2026-09-14"}
  page integer,
  quote text,                                -- verbatim text the value was read from
  quote_verified boolean,                    -- null = not checked yet
  created_at timestamptz not null default now(),
  check (source = 'user' or document_id is not null)
);
create index evidence_items_case_idx on public.evidence_items (case_id, field);

-- ---------- case_facts: the fact sheet, one row per field --------------------------------

create table public.case_facts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  field text not null,
  status text not null
    check (status in ('document', 'user', 'conflict', 'missing', 'needs_check')),
  value_text text,
  value_norm jsonb,
  evidence_item_id uuid references public.evidence_items (id) on delete set null,
  confirmed_by_user boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, field)
);
create trigger case_facts_set_updated_at before update on public.case_facts
  for each row execute function public.set_updated_at();

-- ---------- agent_runs and agent_events --------------------------------------------------

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'running'
    check (status in ('running', 'waiting_for_user', 'plan_ready', 'completed', 'out_of_scope', 'failed')),
  -- 'reading': code reads each document once. 'investigating': the model chooses each step.
  phase text not null default 'reading' check (phase in ('reading', 'investigating', 'done')),
  -- Counts every processed /api/agent/advance call. The browser sends the turn it expects and
  -- the server only advances when it matches, so retries and double clicks cannot run a step twice.
  turn integer not null default 0 check (turn >= 0),
  -- Model-chosen steps taken so far, and their hard ceiling.
  agent_steps integer not null default 0 check (agent_steps >= 0),
  max_agent_steps integer not null default 10 check (max_agent_steps between 1 and 20),
  model text,
  error text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index agent_runs_case_idx on public.agent_runs (case_id, started_at desc);

-- The activity log. Append-only from the API: there is no update or delete policy. Rows go away
-- only when their case is deleted.
create table public.agent_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  seq integer not null check (seq >= 0),
  type text not null,                        -- tool_call, tool_result, question, answer, decision, error
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, seq)
);
create index agent_events_case_idx on public.agent_events (case_id, created_at);

-- ---------- questions --------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('conflict', 'missing', 'confirm', 'document_request')),
  field text,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  answer jsonb,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index questions_case_idx on public.questions (case_id, created_at);

-- ---------- plans and drafts -------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  run_id uuid references public.agent_runs (id) on delete set null,
  ladder_step smallint not null check (ladder_step between 0 and 3),
  summary text,
  reasons jsonb not null default '[]'::jsonb,
  dates jsonb not null default '{}'::jsonb,   -- refund_due, acknowledge_by, resolve_by, ...
  guidance_ids text[] not null default '{}',
  approved_at timestamptz,
  sent_on date,
  outcome text check (outcome in ('refunded', 'acknowledged', 'no_reply', 'refused')),
  created_at timestamptz not null default now()
);
create index plans_case_idx on public.plans (case_id, created_at desc);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  kind text not null check (kind in ('grievance_officer', 'helpline')),
  version integer not null default 1,
  template_md text not null,                 -- model output with fact placeholders, no raw values
  rendered_md text,                          -- placeholders replaced by code
  lint jsonb not null default '{}'::jsonb,
  edited_by_user boolean not null default false,
  created_at timestamptz not null default now()
);
create index drafts_case_idx on public.drafts (case_id, created_at desc);

-- ---------- guidance: hand-checked rule snippets, read-only for the API -------------------

create table public.guidance (
  id text primary key,                       -- short slug, cited by plans
  title text not null,
  body text not null,
  source_name text not null,
  source_url text not null,
  checked_on date not null,                  -- when a human last checked it against the source
  applies_to_steps smallint[] not null default '{}',
  fts tsvector generated always as (to_tsvector('english', title || ' ' || body)) stored
);
create index guidance_fts_idx on public.guidance using gin (fts);

-- ---------- usage limits ------------------------------------------------------------------

create table public.app_settings (
  key text primary key,
  value jsonb not null
);

-- Set these from the free quota shown in Google AI Studio before going public.
insert into public.app_settings (key, value) values
  ('limits', jsonb_build_object('per_user_daily_model_calls', 60, 'global_daily_model_calls', 600));

create table public.model_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  calls integer not null default 0,
  primary key (user_id, day)
);

create table public.model_usage_global (
  day date primary key,
  calls integer not null default 0
);

-- The server calls this before EVERY model call. It is the only way the counters change, and the
-- limits come from app_settings, so a caller cannot raise their own allowance.
create or replace function public.charge_model_call()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  today date := (now() at time zone 'Asia/Kolkata')::date;
  per_user_limit integer;
  global_limit integer;
  user_calls integer;
  global_calls integer;
begin
  if caller is null then
    raise exception 'Sign in before using the model.' using errcode = '28000';
  end if;

  select (s.value ->> 'per_user_daily_model_calls')::integer,
         (s.value ->> 'global_daily_model_calls')::integer
    into per_user_limit, global_limit
    from public.app_settings s
   where s.key = 'limits';

  if per_user_limit is null or global_limit is null then
    raise exception 'Usage limits are not configured.';
  end if;

  insert into public.model_usage (user_id, day) values (caller, today)
    on conflict (user_id, day) do nothing;
  insert into public.model_usage_global (day) values (today)
    on conflict (day) do nothing;

  -- Always lock in the same order (user row, then global row) so calls cannot deadlock.
  select u.calls into user_calls
    from public.model_usage u
   where u.user_id = caller and u.day = today
     for update;
  select g.calls into global_calls
    from public.model_usage_global g
   where g.day = today
     for update;

  if user_calls >= per_user_limit then
    return jsonb_build_object('allowed', false, 'reason', 'user_limit',
                              'user_calls', user_calls, 'user_limit', per_user_limit);
  end if;
  if global_calls >= global_limit then
    return jsonb_build_object('allowed', false, 'reason', 'global_limit',
                              'user_calls', user_calls, 'user_limit', per_user_limit);
  end if;

  update public.model_usage set calls = calls + 1 where user_id = caller and day = today;
  update public.model_usage_global set calls = calls + 1 where day = today;

  return jsonb_build_object('allowed', true, 'reason', null,
                            'user_calls', user_calls + 1, 'user_limit', per_user_limit);
end;
$$;

-- ---------- abuse bounds ------------------------------------------------------------------

create or replace function public.enforce_case_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.cases c where c.user_id = new.user_id) >= 10 then
    raise exception 'You can keep at most 10 cases. Delete one to add another.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger cases_limit before insert on public.cases
  for each row execute function public.enforce_case_limit();

create or replace function public.enforce_document_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.documents d where d.case_id = new.case_id) >= 10 then
    raise exception 'A case can hold at most 10 documents.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger documents_limit before insert on public.documents
  for each row execute function public.enforce_document_limit();

-- ---------- row-level security -------------------------------------------------------------

alter table public.cases enable row level security;

create policy "cases: owner can read" on public.cases
  for select to authenticated using (user_id = (select auth.uid()));
create policy "cases: owner can insert" on public.cases
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "cases: owner can update" on public.cases
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "cases: owner can delete" on public.cases
  for delete to authenticated using (user_id = (select auth.uid()));

-- Child tables: the row must carry the caller's user id AND point at a case the caller owns.
do $do$
declare
  t text;
begin
  foreach t in array array['documents', 'evidence_items', 'case_facts', 'agent_runs',
                           'agent_events', 'questions', 'plans', 'drafts']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (user_id = (select auth.uid()))',
      t || ': owner can read', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()) and public.owns_case(case_id))',
      t || ': owner can insert', t);

    -- The activity log is append-only.
    if t <> 'agent_events' then
      execute format(
        'create policy %I on public.%I for update to authenticated
           using (user_id = (select auth.uid()))
           with check (user_id = (select auth.uid()) and public.owns_case(case_id))',
        t || ': owner can update', t);

      execute format(
        'create policy %I on public.%I for delete to authenticated
           using (user_id = (select auth.uid()))',
        t || ': owner can delete', t);
    end if;
  end loop;
end;
$do$;

alter table public.guidance enable row level security;
create policy "guidance: signed-in users can read" on public.guidance
  for select to authenticated using (true);

alter table public.model_usage enable row level security;
create policy "model_usage: owner can read" on public.model_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- No policies at all: nothing but charge_model_call() and the dashboard can touch these.
alter table public.app_settings enable row level security;
alter table public.model_usage_global enable row level security;

-- ---------- privileges: grant exactly what the API needs -----------------------------------

revoke all on
  public.cases, public.documents, public.evidence_items, public.case_facts,
  public.agent_runs, public.agent_events, public.questions, public.plans, public.drafts,
  public.guidance, public.app_settings, public.model_usage, public.model_usage_global
from anon, authenticated;

grant select, insert, update, delete on
  public.cases, public.documents, public.evidence_items, public.case_facts,
  public.agent_runs, public.questions, public.plans, public.drafts
to authenticated;

grant select, insert on public.agent_events to authenticated;
grant select on public.guidance, public.model_usage to authenticated;

revoke execute on function public.charge_model_call() from public, anon;
grant execute on function public.charge_model_call() to authenticated;

revoke execute on function public.owns_case(uuid) from public, anon;
grant execute on function public.owns_case(uuid) to authenticated;

-- ---------- storage: private evidence bucket -----------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 5242880,
        array['image/png', 'image/jpeg', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files live under <user_id>/<case_id>/...; the first folder decides who may touch them.
create policy "evidence: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "evidence: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "evidence: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
