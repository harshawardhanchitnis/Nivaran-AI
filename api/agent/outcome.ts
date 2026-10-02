import { recordOutcomeRequestSchema } from '../../shared/api.js';
import { requireUser } from '../../server/auth.js';
import { handle, HttpError, json, readJson } from '../../server/http.js';
import { indiaToday } from '../../server/ladder/dates.js';
import { agentRunSchema } from '../../server/agent/rows.js';
export const POST=handle(async request=>{
  const {supabase}=await requireUser(request);
  const input=await readJson(request,recordOutcomeRequestSchema);
  const {data,error}=await supabase.rpc('record_case_outcome',{
    p_plan_id:input.planId,p_request_id:input.requestId,p_outcome:input.outcome,
    p_reply_document_id:input.replyDocumentId??null,p_today:indiaToday(),
  });
  if (error || !data) throw new HttpError(409,'outcome_not_saved','Could not record this update. Finish any current step, check the reply file, then reload and try again. Your earlier complaint is saved.');
  const run=agentRunSchema.safeParse(data);
  if (!run.success) throw new HttpError(503,'outcome_reload','The outcome may be saved. Reload your case to see its progress.');
  return json({run:run.data});
});
