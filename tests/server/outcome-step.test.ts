import { describe, expect, it, vi } from 'vitest';
import type { CaseFactRow, PlanOutcome } from '../../shared/database.js';
import type { ToolContext } from '../../server/agent/tools/types.js';
import { nextStep } from '../../server/ladder/engine.js';
import { outcomeStep } from '../../server/agent/outcome-step.js';
const fact = (field: string, kind: string, value: unknown) =>
  ({ id:field,case_id:'case',user_id:'owner',created_at:'',updated_at:'',value_text:String(value),evidence_item_id:null,
    field, status: 'user', value_norm: { kind, value }, confirmed_by_user: true }) satisfies CaseFactRow;
function context(outcome: PlanOutcome, today = '2026-10-02'): ToolContext {
  const facts = [fact('refund_due_date', 'date', '2026-09-01'), fact('complaint_sent_date','date','2026-09-25'),
    fact('refund_received','boolean',outcome==='refunded'), fact('complaint_acknowledged','boolean',outcome!=='no_reply'),
    fact('complaint_refused','boolean',outcome==='refused')];
  return {
    snapshot: { facts, documents: [], evidence: [], questions: [] },
    state: { quotes_checked: true, outcome_update: { plan_id:'plan', request_id:'request', outcome, recorded_on:today } },
    nextStep: async current => nextStep(current,today),
    searchGuidance: vi.fn(async()=>['ecommerce-grievance-timelines','nch-overview'].map(id=>({id,title:'Test',body:'Scripted checked guidance.',source_name:'Test',source_url:'https://example.org/',checked_on:'2026-10-02',applies_to_steps:[1,2]}))),
  };
}
describe('code recomputes a recorded outcome',()=>{
  it.each([['no_reply',2],['acknowledged',1]] as const)('routes %s to step %s without a model',async(outcome,step)=>{
    const result = await outcomeStep(context(outcome));
    expect(result.plan?.ladder_step).toBe(step);
    expect(result.status).toBe('plan_ready');
    expect(result.state?.outcome_decision_done).toBe(true);
    expect(result.events[0]?.payload).toMatchObject({action:'outcome_recomputed'});
  });
  it('resolves a received refund without a plan or checked rule requirement',async()=>{
    const ctx=context('refunded');
    const result=await outcomeStep(ctx);
    expect(result).toMatchObject({status:'completed',phase:'done',state:{next_step:{outcome:'resolved'}}});
    expect(result.plan).toBeUndefined(); expect(ctx.searchGuidance).not.toHaveBeenCalled();
  });
  it('waits within two days, and escalates acknowledged-only after one calendar month',async()=>{
    const current=context('no_reply');
    current.snapshot.facts=current.snapshot.facts.map(f=>f.field==='complaint_sent_date'?fact(f.field,'date','2026-10-01'):f);
    const within=await outcomeStep(current);
    expect(within.plan?.ladder_step).toBe(1);
    expect(within.state?.next_step?.['canDraft']).toBe(false);
    expect((await outcomeStep(context('acknowledged','2026-11-01'))).plan?.ladder_step).toBe(2);
  });
  it('requires reading a refusal reply and requests a clearer copy if unreadable',async()=>{
    const ctx=context('refused'); ctx.state.outcome_update!.reply_document_id='reply';
    ctx.snapshot.documents=[{id:'reply',label:'E03',read_status:'unreadable'} as ToolContext['snapshot']['documents'][number]];
    const unreadable=await outcomeStep(ctx);
    expect(unreadable).toMatchObject({status:'waiting_for_user',question:{kind:'document_request'}});
    ctx.snapshot.documents[0]!.read_status='read';
    expect((await outcomeStep(ctx)).plan?.ladder_step).toBe(2);
  });
  it('asks for a missing due date and refuses unavailable guidance',async()=>{
    const ctx=context('no_reply'); ctx.snapshot.facts=ctx.snapshot.facts.filter(f=>f.field!=='refund_due_date');
    expect(await outcomeStep(ctx)).toMatchObject({status:'waiting_for_user',question:{field:'refund_due_date'}});
    const unconfirmed=context('no_reply'); unconfirmed.searchGuidance=async()=>[];
    await expect(outcomeStep(unconfirmed)).rejects.toThrow(/guidance/i);
  });
});
