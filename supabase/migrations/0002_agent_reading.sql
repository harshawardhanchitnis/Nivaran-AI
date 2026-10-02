-- T2: claim one request before calling a model; commit reading results atomically.
-- Run after 0001_init.sql in the Supabase SQL Editor. No elevated API client is used.
begin;

alter table public.agent_runs
  add column processing_token uuid,
  add column processing_started_at timestamptz,
  add column reader_state jsonb not null default '{}',
  add constraint agent_runs_claim_pair check ((processing_token is null) = (processing_started_at is null));

create unique index agent_runs_one_active_case on public.agent_runs (case_id)
  where status in ('running', 'waiting_for_user', 'plan_ready');

create function public.claim_agent_turn(p_run_id uuid, p_turn integer, p_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare claimed public.agent_runs;
begin
  if p_token is null or p_turn < 0 then raise exception 'Invalid turn claim.'; end if;
  update public.agent_runs r
     set processing_token = p_token, processing_started_at = now()
   where r.id = p_run_id and r.turn = p_turn and r.status = 'running'
     and (r.processing_token is null or r.processing_started_at < now() - interval '2 minutes')
  returning r.* into claimed;
  if not found then return null; end if;
  return to_jsonb(claimed);
end;
$$;

create function public.release_agent_turn(p_run_id uuid, p_turn integer, p_token uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.agent_runs r set processing_token = null, processing_started_at = null
   where r.id = p_run_id and r.turn = p_turn and r.processing_token = p_token;
$$;

create function public.finish_agent_reading(
  p_run_id uuid, p_turn integer, p_token uuid, p_document_id uuid,
  p_result jsonb, p_read_status text, p_reader_state jsonb, p_event jsonb, p_model text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_run public.agent_runs;
  current_document public.documents;
  added_event public.agent_events;
  next_seq integer;
begin
  select r.* into current_run from public.agent_runs r
   where r.id = p_run_id and r.turn = p_turn and r.processing_token = p_token and r.status = 'running'
   for update;
  if not found then return null; end if;

  if p_document_id is not null then
    if p_read_status not in ('pending', 'read', 'unreadable', 'failed') then
      raise exception 'Invalid document read status.';
    end if;
    select d.* into current_document from public.documents d
     where d.id = p_document_id and d.case_id = current_run.case_id and d.read_status = 'pending'
     for update;
    if not found then raise exception 'Document is not pending in this case.'; end if;
    update public.documents
       set read_status = p_read_status, doc_type = p_result ->> 'doc_type'
     where id = p_document_id;
    if p_read_status = 'read' then
      insert into public.evidence_items (case_id, source, document_id, field, value_text, page, quote)
        select current_run.case_id, 'document', p_document_id, f.field, f.value_text, f.page, f.quote
        from jsonb_to_recordset(p_result -> 'facts') as f(field text, value_text text, page integer, quote text);
    end if;
  end if;

  select coalesce(max(e.seq), -1) + 1 into next_seq from public.agent_events e where e.run_id = p_run_id;
  insert into public.agent_events (run_id, case_id, seq, type, payload)
    values (p_run_id, current_run.case_id, next_seq, p_event ->> 'type', p_event -> 'payload')
    returning * into added_event;
  update public.agent_runs r
     set turn = p_turn + 1,
         phase = case when p_document_id is null then 'investigating' else r.phase end,
         reader_state = p_reader_state, model = coalesce(p_model, r.model),
         processing_token = null, processing_started_at = null
   where r.id = p_run_id and r.turn = p_turn and r.processing_token = p_token and r.status = 'running'
   returning r.* into current_run;
  update public.cases set status = 'investigating' where id = current_run.case_id;
  return jsonb_build_object('run', to_jsonb(current_run), 'events', jsonb_build_array(to_jsonb(added_event)));
end;
$$;

revoke execute on function public.claim_agent_turn(uuid, integer, uuid) from public, anon;
revoke execute on function public.release_agent_turn(uuid, integer, uuid) from public, anon;
revoke execute on function public.finish_agent_reading(uuid, integer, uuid, uuid, jsonb, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.claim_agent_turn(uuid, integer, uuid) to authenticated;
grant execute on function public.release_agent_turn(uuid, integer, uuid) to authenticated;
grant execute on function public.finish_agent_reading(uuid, integer, uuid, uuid, jsonb, text, jsonb, jsonb, text) to authenticated;

-- Owner reported Gemini's limits as 5 RPM, 250K TPM, 20 RPD on 2 October 2026.
-- Reserve five daily provider requests outside this app; all providers share these app caps.
update public.app_settings
   set value = value || jsonb_build_object('per_user_daily_model_calls', 8, 'global_daily_model_calls', 15)
 where key = 'limits';

commit;
