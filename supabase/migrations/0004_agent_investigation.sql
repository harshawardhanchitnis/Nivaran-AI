-- T5: caller-scoped investigation state and an atomic turn commit.
-- Run after 0003. Existing tables and RLS remain in force; no elevated API key.
begin;

alter table public.agent_runs add column agent_state jsonb not null default '{}';

create or replace function public.claim_agent_turn(p_run_id uuid, p_turn integer, p_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare claimed public.agent_runs;
begin
  if p_token is null or p_turn < 0 then raise exception 'Invalid turn claim.'; end if;
  update public.agent_runs r set processing_token = p_token, processing_started_at = now()
   where r.id = p_run_id and r.turn = p_turn
     and (r.status = 'running' or (r.status = 'waiting_for_user' and exists (
       select 1 from public.questions q where q.run_id = r.id and q.answer is not null and q.answered_at is not null
     )))
     and (r.processing_token is null or r.processing_started_at < now() - interval '2 minutes')
  returning r.* into claimed;
  if not found then return null; end if;
  return to_jsonb(claimed);
end;
$$;

create function public.finish_agent_step(p_run_id uuid, p_turn integer, p_token uuid, p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_run public.agent_runs;
  item jsonb;
  next_seq integer;
  new_event public.agent_events;
  new_question public.questions;
  new_plan public.plans;
  new_document public.documents;
  events jsonb := '[]';
  result jsonb;
  next_status text;
  next_phase text;
  counted boolean;
begin
  select r.* into current_run from public.agent_runs r
   where r.id=p_run_id and r.turn=p_turn and r.processing_token=p_token
     and r.status in ('running','waiting_for_user') for update;
  if not found then return null; end if;
  if jsonb_typeof(p_changes) <> 'object' then raise exception 'Invalid step changes.'; end if;
  next_status := coalesce(p_changes->>'status', 'running');
  next_phase := coalesce(p_changes->>'phase', current_run.phase);
  counted := coalesce((p_changes->>'count_step')::boolean, false);
  if counted and current_run.agent_steps >= current_run.max_agent_steps then raise exception 'Step limit reached.'; end if;

  for item in select value from jsonb_array_elements(coalesce(p_changes->'evidence','[]')) loop
    update public.evidence_items e set value_norm=item->'value_norm', quote_verified=(item->>'quote_verified')::boolean
     where e.id=(item->>'id')::uuid and e.case_id=current_run.case_id;
    if not found then raise exception 'Evidence is not in this case.'; end if;
  end loop;

  if p_changes ? 'reread' then
    item := p_changes->'reread';
    select d.* into new_document from public.documents d
     where d.id=(item->>'document_id')::uuid and d.case_id=current_run.case_id for update;
    if not found then raise exception 'Document is not in this case.'; end if;
    update public.documents set read_status=item->>'read_status', doc_type=item->>'doc_type' where id=new_document.id;
    if item->>'read_status' = 'read' then
      insert into public.evidence_items(case_id,source,document_id,field,value_text,page,quote)
        select current_run.case_id,'document',new_document.id,f.field,f.value_text,f.page,f.quote
        from jsonb_to_recordset(item->'facts') as f(field text,value_text text,page integer,quote text);
    end if;
  end if;

  if p_changes ? 'statement' then
    item := p_changes->'statement';
    insert into public.evidence_items(case_id,source,field,value_text)
      values(current_run.case_id,'user',item->>'field',item->>'value_text');
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_changes->'facts','[]')) loop
    if item->>'evidence_item_id' is not null and not exists (
      select 1 from public.evidence_items e where e.id=(item->>'evidence_item_id')::uuid and e.case_id=current_run.case_id
    ) then raise exception 'Fact evidence is not in this case.'; end if;
    insert into public.case_facts(case_id,field,status,value_text,value_norm,evidence_item_id,confirmed_by_user)
      values(current_run.case_id,item->>'field',item->>'status',item->>'value_text',nullif(item->'value_norm','null'),
        (item->>'evidence_item_id')::uuid,coalesce((item->>'confirmed_by_user')::boolean,false))
      on conflict(case_id,field) do update set status=excluded.status,value_text=excluded.value_text,
        value_norm=excluded.value_norm,evidence_item_id=excluded.evidence_item_id,confirmed_by_user=excluded.confirmed_by_user;
  end loop;

  if p_changes ? 'question' then
    item := p_changes->'question';
    insert into public.questions(id,run_id,case_id,kind,field,prompt,options)
      values((item->>'id')::uuid,p_run_id,current_run.case_id,item->>'kind',item->>'field',item->>'prompt',coalesce(item->'options','[]'))
      returning * into new_question;
    if next_status <> 'waiting_for_user' then raise exception 'A question must pause the run.'; end if;
  end if;

  if p_changes ? 'plan' then
    item := p_changes->'plan';
    if exists (select 1 from jsonb_array_elements_text(item->'guidance_ids') g(id)
      where not exists(select 1 from public.guidance checked where checked.id=g.id)) then
      raise exception 'Plan guidance is not available.';
    end if;
    insert into public.plans(case_id,run_id,ladder_step,summary,reasons,dates,guidance_ids)
      values(current_run.case_id,p_run_id,(item->>'ladder_step')::smallint,item->>'summary',item->'reasons',item->'dates',
        array(select jsonb_array_elements_text(item->'guidance_ids'))) returning * into new_plan;
    if next_status <> 'plan_ready' then raise exception 'A plan must wait for approval.'; end if;
  end if;

  select coalesce(max(e.seq),-1)+1 into next_seq from public.agent_events e where e.run_id=p_run_id;
  for item in select value from jsonb_array_elements(coalesce(p_changes->'events','[]')) loop
    insert into public.agent_events(run_id,case_id,seq,type,payload)
      values(p_run_id,current_run.case_id,next_seq,item->>'type',item->'payload') returning * into new_event;
    events := events || jsonb_build_array(to_jsonb(new_event)); next_seq := next_seq+1;
  end loop;
  update public.agent_runs r set turn=p_turn+1,status=next_status,phase=next_phase,
    agent_steps=r.agent_steps+case when counted then 1 else 0 end,
    agent_state=coalesce(p_changes->'state',r.agent_state),model=coalesce(p_changes->>'model',r.model),
    error=p_changes->>'error',ended_at=case when next_status in ('completed','out_of_scope','failed') then now() else null end,
    processing_token=null,processing_started_at=null
    where r.id=p_run_id and r.turn=p_turn and r.processing_token=p_token returning r.* into current_run;
  update public.cases set status=case next_status when 'waiting_for_user' then 'waiting_for_user'
    when 'plan_ready' then 'plan_ready' when 'out_of_scope' then 'out_of_scope' else 'investigating' end
    where id=current_run.case_id;
  result := jsonb_build_object('run',to_jsonb(current_run),'events',events);
  if new_question.id is not null then result := result || jsonb_build_object('question',to_jsonb(new_question)); end if;
  if new_plan.id is not null then result := result || jsonb_build_object('plan',to_jsonb(new_plan)); end if;
  return result;
end;
$$;

revoke execute on function public.finish_agent_step(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.finish_agent_step(uuid,integer,uuid,jsonb) to authenticated;
commit;
