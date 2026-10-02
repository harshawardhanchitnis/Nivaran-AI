import { isFactField } from '../../shared/facts.js';
import { HttpError } from '../http.js';
import { run as askUser } from './tools/ask-user.js';
import { run as requestDocument } from './tools/request-document.js';
import { run as proposePlan } from './tools/propose-plan.js';
import type { InvestigationChanges, ToolContext } from './tools/types.js';

/** A user outcome invokes the fixed ladder in code; no model chooses or changes its result. */
export async function outcomeStep(context: ToolContext): Promise<InvestigationChanges> {
  const update=context.state.outcome_update;
  if (!update) throw new Error('An outcome is required.');
  if (update.outcome==='refused') {
    const reply=context.snapshot.documents.find(d=>d.id===update.reply_document_id);
    if (!reply || reply.read_status!=='read') {
      const request=requestDocument({kind:'a readable copy of the merchant reply',reason:'Use What happened below to attach a clearer PNG, JPG or PDF. Your earlier complaint remains saved.'});
      return {...request.changes,events:[{type:'question',payload:{action:'outcome_reply_needed',message:request.message}}]};
    }
  }
  const decision=await context.nextStep(context.snapshot.facts);
  const state={...context.state,next_step:decision};
  const message=Array.isArray(decision['reasons']) ? decision['reasons'].flatMap(r=>
    r && typeof r==='object' && 'text' in r && typeof r.text==='string' ? [r.text] : []).join(' ') : '';
  if (decision['outcome']==='resolved' || decision['outcome']==='bank_delay')
    return {status:'completed',phase:'done',state:{...state,outcome_decision_done:true},events:[{type:'decision',payload:{action:'outcome_recomputed',message,result:decision}}]};
  if (decision['outcome']==='needs_input') {
    const field=Array.isArray(decision['requiredFields']) ? decision['requiredFields'][0] : null;
    if (!isFactField(field)) throw new HttpError(409,'outcome_needs_review','Review your saved facts before continuing.');
    const question=askUser({field,question:message,options:[]},context);
    return {...question.changes,state,events:[{type:'question',payload:{action:'outcome_needs_input',message:question.message}}]};
  }
  const guidanceIds=Array.isArray(decision['reasons']) ? [...new Set(decision['reasons'].flatMap(r=>
    r && typeof r==='object' && 'guidanceIds' in r && Array.isArray(r.guidanceIds) ? r.guidanceIds.filter((id:unknown):id is string=>typeof id==='string') : []))] : [];
  try {
    const proposal=await proposePlan({summary:message,guidance_ids:guidanceIds},{...context,state});
    return {...proposal.changes,state:{...state,outcome_decision_done:true},events:[{type:'decision',payload:{action:'outcome_recomputed',message:'Recomputed the ladder from your saved facts and outcome. Review the updated plan.',result:decision}}]};
  } catch {
    throw new HttpError(409,'guidance_unavailable','Checked guidance for the updated plan is unavailable. Your outcome and earlier complaint are saved; try again later.');
  }
}
