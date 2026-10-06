-- Preserve the last actual answering model when a complaint is assembled without a model.
-- Replaces only the existing caller-scoped finish transaction; ownership and claims remain.
begin;
create or replace function public.finish_plan_draft(p_plan_id uuid,p_token uuid,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare chosen public.plans; saved public.drafts; event_seq integer; origin text;
begin
 select p.* into chosen from public.plans p where p.id=p_plan_id and p.draft_claim_token=p_token and p.approved_at is not null and p.rejected_at is null and p.ladder_step in (1,2) for update;
 if not found then return null; end if;
 if exists(select 1 from public.case_facts f where f.case_id=chosen.case_id and f.updated_at>chosen.created_at) then raise exception 'The facts have changed. Review a fresh plan.'; end if;
 if jsonb_typeof(p_result)<>'object' or coalesce(length(p_result->>'template_md'),0) not between 1 and 20000 or coalesce(length(p_result->>'rendered_md'),0) not between 1 and 20000 then raise exception 'Invalid draft.'; end if;
 origin:=coalesce(p_result->>'generationKind','model');
 if origin not in ('model','code_basic') then raise exception 'Invalid draft origin.'; end if;
 insert into public.drafts(case_id,plan_id,kind,version,template_md,rendered_md,lint)
 values(chosen.case_id,chosen.id,case when chosen.ladder_step=1 then 'grievance_officer' else 'helpline' end,1,p_result->>'template_md',p_result->>'rendered_md',coalesce(p_result->'lint','{}')||jsonb_build_object('generationKind',origin)) returning * into saved;
 update public.plans set draft_claim_token=null,draft_claimed_at=null where id=chosen.id;
 if chosen.run_id is not null then
  perform 1 from public.agent_runs r where r.id=chosen.run_id for update;
  if origin='model' then update public.agent_runs set model=p_result->>'modelId' where id=chosen.run_id; end if;
  select coalesce(max(e.seq),-1)+1 into event_seq from public.agent_events e where e.run_id=chosen.run_id;
  insert into public.agent_events(run_id,case_id,seq,type,payload) values(chosen.run_id,chosen.case_id,event_seq,'tool_result',jsonb_build_object(
   'tool','write_draft','generationKind',origin,
   'modelId',case when origin='model' then p_result->>'modelId' else null end,
   'answeringModels',case when origin='model' then p_result->'answeringModels' else '[]'::jsonb end,
   'message',case when origin='code_basic' then 'Assembled a basic complaint without a model call. Review it before sending.' else 'Prepared a complaint draft. Review it before sending.' end));
 end if;
 return to_jsonb(saved);
end;
$$;
commit;
