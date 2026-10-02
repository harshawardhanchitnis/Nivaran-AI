-- T11: user outcomes, replay-safe continuation and waiting-plan draft protection. Apply after 0009.
begin;
create unique index outcome_request_per_case on public.agent_runs(case_id,(agent_state->'outcome_update'->>'request_id'))
 where agent_state ? 'outcome_update';

create function public.record_case_outcome(p_plan_id uuid,p_request_id uuid,p_outcome text,p_reply_document_id uuid,p_today date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare chosen public.plans; current_case public.cases; resumed public.agent_runs; item record; evidence_id uuid; update_data jsonb;
begin
 if p_request_id is null or p_today is null or p_outcome is null or p_outcome not in ('refunded','acknowledged','no_reply','refused') then raise exception 'Invalid outcome.'; end if;
 select p.* into chosen from public.plans p where p.id=p_plan_id and p.approved_at is not null and p.rejected_at is null and p.ladder_step=1 and p.sent_on is not null for update;
 if not found or not exists(select 1 from public.drafts d where d.plan_id=chosen.id) then return null; end if;
 select c.* into current_case from public.cases c where c.id=chosen.case_id for update;
 if not found then return null; end if;
 select r.* into resumed from public.agent_runs r where r.case_id=chosen.case_id and r.agent_state->'outcome_update'->>'request_id'=p_request_id::text;
 if found then
  if resumed.agent_state->'outcome_update'->>'outcome'<>p_outcome or resumed.agent_state->'outcome_update'->>'plan_id'<>p_plan_id::text or coalesce(resumed.agent_state->'outcome_update'->>'reply_document_id','')<>coalesce(p_reply_document_id::text,'') then raise exception 'This request already records a different outcome.'; end if;
  return to_jsonb(resumed);
 end if;
 if current_case.status='resolved' or p_today<chosen.sent_on then return null; end if;
 if exists(select 1 from public.agent_runs r where r.case_id=chosen.case_id and r.processing_token is not null and r.processing_started_at>now()-interval '2 minutes')
  or exists(select 1 from public.plans p where p.case_id=chosen.case_id and p.draft_claim_token is not null and p.draft_claimed_at>now()-interval '2 minutes') then raise exception 'Finish the current step first.'; end if;
 if p_outcome='refused' then
  if p_reply_document_id is null or not exists(select 1 from public.documents d where d.id=p_reply_document_id and d.case_id=chosen.case_id and d.read_status='pending') then raise exception 'Add the written reply to this case first.'; end if;
 elsif p_reply_document_id is not null then raise exception 'Only a refusal takes a reply file.'; end if;
 -- Earlier approved complaints and their versions remain intact. Idle proposals are superseded.
 update public.plans set rejected_at=now() where case_id=chosen.case_id and approved_at is null and rejected_at is null;
 update public.agent_runs set status='completed',phase='done',turn=turn+1,ended_at=now(),processing_token=null,processing_started_at=null
  where case_id=chosen.case_id and status in ('running','waiting_for_user','plan_ready');
 for item in select * from (values
  ('refund_received',p_outcome='refunded'),('complaint_acknowledged',p_outcome in ('acknowledged','refused')),('complaint_refused',p_outcome='refused')) as v(field,value) loop
  insert into public.evidence_items(case_id,source,field,value_text,value_norm)
   values(chosen.case_id,'user',item.field,item.value::text,jsonb_build_object('kind','boolean','value',item.value)) returning id into evidence_id;
  insert into public.case_facts(case_id,field,status,value_text,value_norm,evidence_item_id,confirmed_by_user)
   values(chosen.case_id,item.field,'user',item.value::text,jsonb_build_object('kind','boolean','value',item.value),evidence_id,true)
   on conflict(case_id,field) do update set status='user',value_text=excluded.value_text,value_norm=excluded.value_norm,evidence_item_id=excluded.evidence_item_id,confirmed_by_user=true;
 end loop;
 update public.plans set outcome=p_outcome where id=chosen.id;
 update_data=jsonb_build_object('plan_id',chosen.id,'request_id',p_request_id,'outcome',p_outcome,'recorded_on',p_today);
 if p_reply_document_id is not null then update_data=update_data||jsonb_build_object('reply_document_id',p_reply_document_id); end if;
 insert into public.agent_runs(case_id,status,phase,agent_state)
  values(chosen.case_id,'running',case when p_outcome='refused' then 'reading' else 'investigating' end,
   jsonb_build_object('quotes_checked',p_outcome<>'refused','outcome_update',update_data)) returning * into resumed;
 insert into public.agent_events(run_id,case_id,seq,type,payload)
  values(resumed.id,chosen.case_id,0,'answer',jsonb_build_object('action','record_outcome','outcome',p_outcome,'replyDocumentId',p_reply_document_id,'message',case p_outcome
   when 'refunded' then 'You recorded that the refund arrived. Saved as Your statement.'
   when 'acknowledged' then 'You recorded an acknowledgement without a refund. Saved as Your statement.'
   when 'no_reply' then 'You recorded no reply or refund. Saved as Your statement.'
   else 'You recorded a written refusal. Saved as Your statement; the reply will be read as data.' end));
 update public.cases set status='investigating' where id=chosen.case_id;
 return to_jsonb(resumed);
end;
$$;
revoke execute on function public.record_case_outcome(uuid,uuid,text,uuid,date) from public,anon;
grant execute on function public.record_case_outcome(uuid,uuid,text,uuid,date) to authenticated;

-- A step-one plan with an existing sent date is waiting, rather than another letter to send.
create function public.set_waiting_plan_sent_date() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.ladder_step=1 then
  select (f.value_norm->>'value')::date into new.sent_on from public.case_facts f where f.case_id=new.case_id and f.field='complaint_sent_date'
   and f.status in ('document','user') and f.value_norm->>'kind'='date';
 end if;
 return new;
end;
$$;
create trigger waiting_plan_sent_date before insert on public.plans for each row execute function public.set_waiting_plan_sent_date();

create or replace function public.claim_plan_draft(p_plan_id uuid,p_token uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare chosen public.plans;
begin
 select p.* into chosen from public.plans p where p.id=p_plan_id and p.approved_at is not null and p.rejected_at is null and p.ladder_step in (1,2) for update;
 if not found or p_token is null or (chosen.ladder_step=1 and chosen.sent_on is not null) then return null; end if;
 if exists(select 1 from public.drafts d where d.plan_id=chosen.id) then return null; end if;
 if exists(select 1 from public.case_facts f where f.case_id=chosen.case_id and f.updated_at>chosen.created_at) then raise exception 'The facts have changed. Review a fresh plan.'; end if;
 if chosen.draft_claim_token is not null and chosen.draft_claimed_at>now()-interval '2 minutes' then return null; end if;
 update public.plans set draft_claim_token=p_token,draft_claimed_at=now() where id=chosen.id returning * into chosen;
 return to_jsonb(chosen);
end;
$$;
commit;
