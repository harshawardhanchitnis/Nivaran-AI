import type { FactField } from '@shared/facts';
import type { FactView, PlanView, QuestionView } from './models';

export function factGroups(facts: readonly FactView[], required: readonly FactField[]) {
  const core: readonly FactField[] = ['merchant_name', 'order_id', 'refund_amount', 'refund_received', 'refund_due_date', 'refund_promise_date', 'complaint_sent_date'];
  const attention = facts.filter(f => f.status === 'conflict' || f.status === 'needs_check' || required.includes(f.field));
  const remaining = facts.filter(f => !attention.includes(f));
  return { attention, core: remaining.filter(f => core.includes(f.field) || f.status !== 'missing'),
    other: remaining.filter(f => !core.includes(f.field) && f.status === 'missing') };
}

export function workspaceNextAction(state: { readOnly: boolean; practice?: boolean; busy: boolean; question: QuestionView | null; plan: PlanView | null; approved: boolean; draft: boolean; stage: string }): { title: string; detail: string; tab: 'facts' | 'activity' | 'plan' | 'complaint'; button: string } {
  if (state.readOnly) return { title: 'Explore this recorded case', detail: 'Check the source quotes, recorded decisions and outcome. This record cannot be changed.', tab: 'facts', button: 'See the facts' };
  if (state.busy) return { title: 'Nivaran is working through your case', detail: 'Progress is saved after each step. You can leave and return.', tab: 'activity', button: 'See progress' };
  if (state.question) return { title: 'Your answer is the next step', detail: 'Compare the sources before choosing. Your answer is saved as Your statement.', tab: 'facts', button: 'Review the question' };
  if (state.practice && state.draft) return { title:'Try complaint review on invented data',detail:'Edit the practice text and check a made-up ID with the real linter. Changes stay only in this page.',tab:'complaint',button:'Open practice editor' };
  if (state.practice && state.approved) return { title:'Prepare the practice complaint',detail:'This uses invented facts and the real basic renderer without a model call.',tab:'complaint',button:'Choose practice preparation' };
  if (state.draft) return { title: 'Review your complaint before sending', detail: 'Check dates, inserted values and any flagged edits. You choose how and when to send it.', tab: 'complaint', button: 'Review complaint' };
  if (state.plan) {
    if (state.plan.step === 0 || state.plan.step === 3 || state.plan.waitingForReply) return { title: 'Review the next date and guidance', detail: 'This plan has nothing new to send now. Check its reasons and recommended next step.', tab: 'plan', button: 'Review plan' };
    if (state.approved) return { title: 'Prepare a complaint you can review', detail: 'Choose AI wording or a basic complaint from your approved facts. Nothing is sent for you.', tab: 'complaint', button: 'Choose complaint wording' };
    return { title: 'The plan needs your review', detail: 'Read the reasons and dates, then approve, request a change or reject.', tab: 'plan', button: 'Review plan' };
  }
  return { title: state.stage, detail: 'Your saved facts and activity explain where the case stopped. Check the message above for any action needed.', tab: 'facts', button: 'Review saved facts' };
}
