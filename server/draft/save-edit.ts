import type { AgentDraftEditRequest } from '../../shared/api.js';
import { lintDraft } from '../../shared/draft-lint.js';
import { draftLintSpans } from '../../shared/draft-render.js';
import { normaliseDate } from '../../shared/normalise.js';
import type { DraftEditStore } from './store.js';
import { HttpError } from '../http.js';
export async function saveDraftEdit(
  store: DraftEditStore,
  input: AgentDraftEditRequest,
  today: string,
) {
  const original = await store.getDraft(input.draftId);
  const plan = await store.getPlan(original.plan_id);
  if (!plan.approved_at || plan.rejected_at)
    throw new HttpError(409, 'plan_not_approved', 'This plan is not approved.');
  const context = await store.context(plan, today);
  const on = original.lint['generatedOn'];
  const generatedOn = typeof on === 'string' && normaliseDate(on) === on ? on : today;
  const flags = lintDraft(input.text, {
    ...context,
    ignore: draftLintSpans(original.template_md, input.text, { ...context, today: generatedOn }),
    userStatements: input.userStatements,
  });
  const saved = await store.saveEdit(original, input.text, {
    flags,
    userStatements: input.userStatements,
    generatedOn,
  });
  if (!saved) throw new HttpError(409, 'draft_changed', 'This draft changed. Reload your case.');
  return saved;
}
