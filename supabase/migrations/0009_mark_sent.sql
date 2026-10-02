-- T10: the user records sending their approved grievance officer complaint. No tool sends it.
begin;
create function public.mark_plan_sent(p_plan_id uuid,p_sent_on date,p_today date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare chosen public.plans; stated public.case_facts; evidence_id uuid; event_seq integer;
begin
 if p_sent_on is null or p_today is null or p_sent_on>p_today then raise exception 'Use a sent date on or before today.'; end if;
 select p.* into chosen from public.plans p where p.id=p_plan_id and p.approved_at is not null and p.rejected_at is null and p.ladder_step=1 for update;
 if not found or not exists(select 1 from public.drafts d where d.plan_id=chosen.id) then return null; end if;
 select f.* into stated from public.case_facts f where f.case_id=chosen.case_id and f.field='complaint_sent_date';
 if chosen.sent_on=p_sent_on and stated.status='user' and stated.value_norm->>'value'=p_sent_on::text then return jsonb_build_object('plan',to_jsonb(chosen),'fact',to_jsonb(stated)); end if;
 insert into public.evidence_items(case_id,source,field,value_text,value_norm)
 values(chosen.case_id,'user','complaint_sent_date',p_sent_on::text,jsonb_build_object('kind','date','value',p_sent_on::text)) returning id into evidence_id;
 insert into public.case_facts(case_id,field,status,value_text,value_norm,evidence_item_id,confirmed_by_user)
 values(chosen.case_id,'complaint_sent_date','user',p_sent_on::text,jsonb_build_object('kind','date','value',p_sent_on::text),evidence_id,true)
 on conflict(case_id,field) do update set status='user',value_text=excluded.value_text,value_norm=excluded.value_norm,evidence_item_id=excluded.evidence_item_id,confirmed_by_user=true returning * into stated;
 update public.plans set sent_on=p_sent_on,dates=dates||jsonb_build_object('acknowledge_by',(p_sent_on+2)::text,'resolve_by',(p_sent_on+interval '1 month')::date::text) where id=chosen.id returning * into chosen;
 update public.cases set status='sent',ladder_step=1 where id=chosen.case_id;
 if chosen.run_id is not null then
  perform 1 from public.agent_runs r where r.id=chosen.run_id for update;
  select coalesce(max(e.seq),-1)+1 into event_seq from public.agent_events e where e.run_id=chosen.run_id;
  insert into public.agent_events(run_id,case_id,seq,type,payload)
  values(chosen.run_id,chosen.case_id,event_seq,'answer',jsonb_build_object('action','mark_as_sent','sentOn',p_sent_on::text,'message','You recorded sending the complaint on '||p_sent_on::text||'. Saved as Your statement.'));
 end if;
 return jsonb_build_object('plan',to_jsonb(chosen),'fact',to_jsonb(stated));
end;
$$;
revoke execute on function public.mark_plan_sent(uuid,date,date) from public,anon;
grant execute on function public.mark_plan_sent(uuid,date,date) to authenticated;
commit;
