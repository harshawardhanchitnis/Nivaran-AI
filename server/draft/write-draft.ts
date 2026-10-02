import type { DraftRow, GuidanceRow, PlanRow } from '../../shared/database.js';
import { renderDraft, DraftPlaceholderError } from './render.js';
import type { DraftRenderContext } from './render.js';
import { lintDraft } from '../../shared/draft-lint.js';
import { HttpError } from '../http.js';
export interface DraftSnapshot extends DraftRenderContext {
  guidance: GuidanceRow[];
}
export interface DraftSave {
  template_md: string;
  rendered_md: string;
  lint: Record<string, unknown>;
  modelId: string;
  answeringModels: string[];
}
export interface DraftStore {
  getPlan(id: string): Promise<PlanRow>;
  existing(planId: string): Promise<DraftRow | null>;
  claim(planId: string): Promise<PlanRow | null>;
  release(plan: PlanRow): Promise<void>;
  context(plan: PlanRow, today: string): Promise<DraftSnapshot>;
  save(plan: PlanRow, result: DraftSave): Promise<DraftRow | null>;
}
export interface DraftDependencies {
  today(): string;
  generate(
    plan: PlanRow,
    context: DraftSnapshot,
    repair: boolean,
  ): Promise<{ template: string; modelId: string }>;
}
/** Initial generation is idempotent; only approved complaint steps can claim and spend quota. */
export async function writeDraft(
  store: DraftStore,
  deps: DraftDependencies,
  planId: string,
): Promise<DraftRow> {
  const plan = await store.getPlan(planId);
  if (!plan.approved_at || plan.rejected_at)
    throw new HttpError(409, 'plan_not_approved', 'Approve the plan before preparing a complaint.');
  if (plan.ladder_step !== 1 && plan.ladder_step !== 2)
    throw new HttpError(409, 'no_complaint_needed', 'This step has nothing to draft.');
  const existing = await store.existing(plan.id);
  if (existing) return existing;
  const claimed = await store.claim(plan.id);
  if (!claimed) {
    const saved = await store.existing(plan.id);
    if (saved) return saved;
    throw new HttpError(
      409,
      'draft_in_progress',
      'A draft is already being prepared. Your case is saved; try again shortly.',
    );
  }
  let saved = false;
  try {
    const context = await store.context(claimed, deps.today());
    const answeringModels: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const answer = await deps.generate(claimed, context, attempt === 1);
      answeringModels.push(answer.modelId);
      let rendered;
      try {
        if (
          answer.template.length > 20000 ||
          !answer.template.trim() ||
          /\d/.test(answer.template.replace(/{{[^{}]+}}/g, ''))
        )
          throw new DraftPlaceholderError();
        rendered = renderDraft(answer.template, context);
      } catch (error) {
        if (!(error instanceof DraftPlaceholderError)) throw error;
        if (attempt === 0) continue;
        throw new HttpError(
          502,
          'draft_template_invalid',
          'The model could not prepare a draft using your facts. Your plan is safe; try again.',
        );
      }
      const flags = lintDraft(rendered.text, { ...context, ignore: rendered.spans });
      const result = await store.save(claimed, {
        template_md: answer.template,
        rendered_md: rendered.text,
        lint: { flags, userStatements: [], generatedOn: context.today },
        modelId: answer.modelId,
        answeringModels,
      });
      if (!result)
        throw new HttpError(
          409,
          'draft_changed',
          'This draft changed while it was being prepared. Reload your case.',
        );
      saved = true;
      return result;
    }
    throw new HttpError(
      502,
      'draft_template_invalid',
      'Could not prepare the complaint. Try again.',
    );
  } finally {
    if (!saved) await store.release(claimed);
  }
}
