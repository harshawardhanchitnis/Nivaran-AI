import type { CaseFactRow, GuidanceRow, PlanRow } from '@shared/database';
import { workspacePlan } from './workspace-plan';
const guidance={id:'rule',title:'Test rule',body:'Scripted rule text.',source_name:'Test source',source_url:'https://example.org/rule',checked_on:'2026-10-01',applies_to_steps:[0,1]} as GuidanceRow;
const plan:PlanRow={id:'plan',case_id:'case',user_id:'owner',run_id:'run',sent_on:null,outcome:null,created_at:'2026-10-01T12:00:00Z',ladder_step:1,summary:'Ask for the overdue refund.',reasons:[{text:'The refund is overdue.'},{code:'calculation_note',text:'A stated working assumption.'}],dates:{today:'2026-10-01',refund_due:'2026-09-24',acknowledge_by:'2026-10-03',resolve_by:'2026-11-01'},guidance_ids:['rule'],approved_at:null,rejected_at:null,draft_claim_token:null,draft_claimed_at:null};
describe('saved plans in the existing view model',()=> {
  it('uses code reasons and only stored checked rule text, source URL and date',()=> {
    const view=workspacePlan(plan,[guidance],[],'2026-10-02')!;
    expect(view.step).toBe(1);expect(view.reasons).toContainEqual({text:'The refund is overdue.'});
    expect(view.reasons).toContainEqual({text:'Scripted rule text.',sourceName:'Test source',sourceUrl:'https://example.org/rule',checkedOn:'2026-10-01'});
    expect(view.timeline.find(i=>i.id==='today')).toMatchObject({date:'2 Oct 2026',tone:'today'});
    expect(view.timeline.find(i=>i.id==='refund_due')).toMatchObject({date:'24 Sept 2026',tone:'overdue'});
    expect(view.timeline.find(i=>i.id==='acknowledge_by')).toMatchObject({tone:'upcoming',note:expect.stringContaining('sent date')});
  });
  it('hides rejected, invalid and unavailable-guidance proposals',()=> {
    expect(workspacePlan({...plan,rejected_at:'2026-10-02'},[guidance],[],'2026-10-02')).toBeNull();
    expect(workspacePlan({...plan,ladder_step:9},[guidance],[],'2026-10-02')).toBeNull();
    expect(workspacePlan(plan,[],[],'2026-10-02')).toBeNull();
    expect(workspacePlan(plan,[{...guidance,checked_on:'2026-10-03'}],[],'2026-10-02')).toBeNull();
    expect(workspacePlan(plan,[{...guidance,source_url:'javascript:alert(1)'}],[],'2026-10-02')).toBeNull();
  });
  it('maps wait plans and includes only usable dated facts and valid deadlines',()=> {
    const facts:Pick<CaseFactRow,'field'|'status'|'value_norm'>[]=[{field:'order_date',status:'document',value_norm:{kind:'date',value:'2026-09-14'}},
      {field:'refund_promise_date',status:'conflict',value_norm:{kind:'date',value:'2026-09-17'}}];
    const view=workspacePlan({...plan,ladder_step:0,dates:{refund_due:'2026-10-10',resolve_by:'2026-02-30'}},[guidance],facts,'2026-10-02')!;
    expect(view.headline).toContain('Wait');expect(view.timeline.find(i=>i.id==='order_date')).toMatchObject({date:'14 Sept 2026',tone:'past'});
    expect(view.timeline.some(i=>i.id==='refund_promise_date'||i.id==='resolve_by')).toBe(false);
  });
});
