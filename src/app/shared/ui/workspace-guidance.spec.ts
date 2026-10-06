import { factGroups, workspaceNextAction } from './workspace-guidance';
import type { FactView, PlanView, QuestionView } from './models';

describe('case guidance without inventing progress', () => {
  const fact = (field: FactView['field'], status: FactView['status']): FactView => ({ field, status, value: null, label: field, sources: [] });
  it('shows blockers first and preserves every fact exactly once', () => {
    const facts = [fact('item_description', 'missing'), fact('refund_amount', 'conflict'), fact('order_id', 'document'), fact('refund_received', 'missing'), fact('refund_reference', 'document')];
    const groups = factGroups(facts, ['refund_received']);
    expect(groups.attention.map(f => f.field)).toEqual(['refund_amount', 'refund_received']);
    expect(groups.core.map(f => f.field)).toEqual(['order_id', 'refund_reference']);
    expect(groups.other.map(f => f.field)).toEqual(['item_description']);
    expect([...groups.attention, ...groups.core, ...groups.other].length).toBe(facts.length);
  });
  const base = { readOnly: false, busy: false, question: null, plan: null, approved: false, draft: false, stage: 'Could not finish' };
  it('keeps an unanswered question ahead of an old plan', () => {
    const next = workspaceNextAction({ ...base, question: { id:'q' } as QuestionView, plan: { step:1 } as PlanView });
    expect(next.tab).toBe('facts'); expect(next.title).toContain('answer');
  });
  it.each([0, 3])('does not suggest a complaint at step %s', step => {
    const next = workspaceNextAction({ ...base, plan: { step } as PlanView, approved: true });
    expect(next.tab).toBe('plan'); expect(next.detail).toContain('nothing new to send');
  });
  it('routes approval, preparation and review to the proper existing tab', () => {
    const plan = { step: 1 } as PlanView;
    expect(workspaceNextAction({ ...base, plan }).tab).toBe('plan');
    expect(workspaceNextAction({ ...base, plan, approved:true }).title).toContain('Prepare');
    expect(workspaceNextAction({ ...base, plan, draft:true }).title).toContain('Review');
  });
  it('labels saved runs as recorded instead of asking a visitor to answer', () => {
    expect(workspaceNextAction({ ...base, readOnly:true, question:{id:'q'} as QuestionView }).detail).toContain('cannot be changed');
  });
});
