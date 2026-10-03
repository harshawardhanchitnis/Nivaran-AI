-- User-initiated clearer/missing-file recovery. Caller RLS remains in force.
begin;
create function public.resume_document_reading(p_case_id uuid, p_document_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_run public.agent_runs; current_question public.questions; next_seq integer;
begin
  perform 1 from public.cases where id=p_case_id and user_id=(select auth.uid()) for update;
  if not found then raise exception 'This case is not available.' using errcode='42501'; end if;
  select * into current_run from public.agent_runs where case_id=p_case_id order by started_at desc limit 1 for update;
  if not found then raise exception 'Open the case before adding a replacement.'; end if;
  -- A lost response may be retried even after this new file has been read.
  if exists(select 1 from public.agent_events where run_id=current_run.id and payload->>'action'='document_added'
     and payload->>'documentId'=p_document_id::text) then return to_jsonb(current_run); end if;
  if current_run.processing_token is not null and current_run.processing_started_at >= now()-interval '2 minutes' then
    raise exception 'A case step is still running. Wait and retry.';
  end if;
  select * into current_question from public.questions where run_id=current_run.id order by created_at desc limit 1 for update;
  if current_run.status <> 'failed' and not (current_run.status='waiting_for_user' and current_question.kind='document_request' and current_question.answer is null) then
    raise exception 'A replacement is allowed only for a requested document or a failed run.';
  end if;
  perform 1 from public.documents where id=p_document_id and case_id=p_case_id and read_status='pending';
  if not found then raise exception 'Add a new document in this case before continuing.'; end if;
  if current_question.kind='document_request' and current_question.answer is null then
    update public.questions set answer=jsonb_build_object('documentId',p_document_id),answered_at=now() where id=current_question.id;
  end if;
  update public.agent_runs set status='running',phase='reading',turn=turn+1,error=null,
    processing_token=null,processing_started_at=null,reader_state='{}',
    agent_state=(agent_state-array['next_step','pending_reread','image_quote_role']::text[]) || jsonb_build_object('quotes_checked',false)
      || case when current_question.kind='document_request' then jsonb_build_object('answered_question_id',current_question.id) else '{}'::jsonb end
    where id=current_run.id returning * into current_run;
  -- agent_steps and max_agent_steps are deliberately preserved.
  update public.cases set status='investigating' where id=p_case_id;
  select coalesce(max(seq),-1)+1 into next_seq from public.agent_events where run_id=current_run.id;
  insert into public.agent_events(run_id,case_id,seq,type,payload) values(current_run.id,p_case_id,next_seq,'answer',
    jsonb_build_object('action','document_added','documentId',p_document_id,'message','You added a document. Resuming reading; earlier facts are saved.'));
  return to_jsonb(current_run);
end; $$;
revoke execute on function public.resume_document_reading(uuid,uuid) from public, anon;
grant execute on function public.resume_document_reading(uuid,uuid) to authenticated;
commit;
