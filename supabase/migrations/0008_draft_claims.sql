-- T9: exclusive generation claims, versioned draft saves and review events. Apply after 0007.
begin;
alter table public.plans add column draft_claim_token uuid;
alter table public.plans add column draft_claimed_at timestamptz;
alter table public.drafts add constraint draft_plan_version_unique unique(plan_id,version);
create function public.claim_plan_draft(p_plan_id uuid,p_token uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare chosen public.plans;
begin
 select p.* into chosen from public.plans p where p.id=p_plan_id and p.approved_at is not null and p.rejected_at is null and p.ladder_step in (1,2) for update;
 if not found or p_token is null then return null; end if;
 if exists(select 1 from public.drafts d where d.plan_id=chosen.id) then return null; end if;
 if exists(select 1 from public.case_facts f where f.case_id=chosen.case_id and f.updated_at>chosen.created_at) then raise exception 'The facts have changed. Review a fresh plan.'; end if;
 if chosen.draft_claim_token is not null and chosen.draft_claimed_at>now()-interval '2 minutes' then return null; end if;
 update public.plans set draft_claim_token=p_token,draft_claimed_at=now() where id=chosen.id returning * into chosen;
 return to_jsonb(chosen);
end;
$$;
create function public.release_plan_draft(p_plan_id uuid,p_token uuid)
returns void language sql security invoker set search_path='' as $$
 update public.plans set draft_claim_token=null,draft_claimed_at=null where id=p_plan_id and draft_claim_token=p_token;
$$;
create function public.finish_plan_draft(p_plan_id uuid,p_token uuid,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare chosen public.plans; saved public.drafts; event_seq integer;
begin
 select p.* into chosen from public.plans p where p.id=p_plan_id and p.draft_claim_token=p_token and p.approved_at is not null and p.rejected_at is null and p.ladder_step in (1,2) for update;
 if not found then return null; end if;
 if exists(select 1 from public.case_facts f where f.case_id=chosen.case_id and f.updated_at>chosen.created_at) then raise exception 'The facts have changed. Review a fresh plan.'; end if;
 if jsonb_typeof(p_result)<>'object' or coalesce(length(p_result->>'template_md'),0) not between 1 and 20000 or coalesce(length(p_result->>'rendered_md'),0) not between 1 and 20000 then raise exception 'Invalid draft.'; end if;
 insert into public.drafts(case_id,plan_id,kind,version,template_md,rendered_md,lint)
 values(chosen.case_id,chosen.id,case when chosen.ladder_step=1 then 'grievance_officer' else 'helpline' end,1,p_result->>'template_md',p_result->>'rendered_md',coalesce(p_result->'lint','{}')) returning * into saved;
 update public.plans set draft_claim_token=null,draft_claimed_at=null where id=chosen.id;
 if chosen.run_id is not null then
  perform 1 from public.agent_runs r where r.id=chosen.run_id for update;
  update public.agent_runs set model=p_result->>'modelId' where id=chosen.run_id;
  select coalesce(max(e.seq),-1)+1 into event_seq from public.agent_events e where e.run_id=chosen.run_id;
  insert into public.agent_events(run_id,case_id,seq,type,payload) values(chosen.run_id,chosen.case_id,event_seq,'tool_result',jsonb_build_object('tool','write_draft','modelId',p_result->>'modelId','answeringModels',p_result->'answeringModels','message','Prepared a complaint draft. Review it before sending.'));
 end if;
 return to_jsonb(saved);
end;
$$;
create function public.save_draft_edit(p_draft_id uuid,p_text text,p_lint jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare original public.drafts; chosen public.plans; saved public.drafts; next_version integer;
begin
 select d.* into original from public.drafts d where d.id=p_draft_id;
 if not found then return null; end if;
 select p.* into chosen from public.plans p where p.id=original.plan_id and p.approved_at is not null and p.rejected_at is null for update;
 if not found then return null; end if;
 if coalesce(length(p_text),0) not between 1 and 20000 or jsonb_typeof(p_lint)<>'object' then raise exception 'Invalid edited draft.'; end if;
 select coalesce(max(d.version),0)+1 into next_version from public.drafts d where d.plan_id=chosen.id;
 insert into public.drafts(case_id,plan_id,kind,version,template_md,rendered_md,lint,edited_by_user)
 values(chosen.case_id,chosen.id,original.kind,next_version,original.template_md,p_text,p_lint,true) returning * into saved;
 return to_jsonb(saved);
end;
$$;
revoke execute on function public.claim_plan_draft(uuid,uuid),public.release_plan_draft(uuid,uuid),public.finish_plan_draft(uuid,uuid,jsonb),public.save_draft_edit(uuid,text,jsonb) from public,anon;
grant execute on function public.claim_plan_draft(uuid,uuid),public.release_plan_draft(uuid,uuid),public.finish_plan_draft(uuid,uuid,jsonb),public.save_draft_edit(uuid,text,jsonb) to authenticated;
commit;
