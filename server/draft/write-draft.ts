import type { DraftRow, DraftGenerationKind, GuidanceRow, PlanRow } from '../../shared/database.js';
import { renderDraft, DraftPlaceholderError } from './render.js';
import type { DraftRenderContext } from './render.js';
import { lintDraft } from '../../shared/draft-lint.js';
import { HttpError } from '../http.js';
import { assembleComplaint, basicComplaint, templateIssue } from './template.js';
import type { TemplateIssue } from './template.js';
export interface DraftSnapshot extends DraftRenderContext {
  guidance: GuidanceRow[];
}
export interface DraftSave {
  template_md: string;
  rendered_md: string;
  lint: Record<string, unknown>;
  modelId: string | null;
  generationKind: DraftGenerationKind;
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
    issues?: readonly TemplateIssue[],
  ): Promise<{ template: string; modelId: string }>;
}
/** Initial generation is idempotent; only approved complaint steps can claim and spend quota. */
export async function writeDraft(
  store: DraftStore,
  deps: DraftDependencies,
  planId: string,
  mode: 'model' | 'basic' = 'model',
): Promise<DraftRow> {
  const plan = await store.getPlan(planId);
  if (!plan.approved_at || plan.rejected_at)
    throw new HttpError(409, 'plan_not_approved', 'Approve the plan before preparing a complaint.');
  if (plan.ladder_step !== 1 && plan.ladder_step !== 2)
    throw new HttpError(409, 'no_complaint_needed', 'This step has nothing to draft.');
  const existing = await store.existing(plan.id);
  if (existing) return existing;
  if (plan.ladder_step === 1 && plan.sent_on)
    throw new HttpError(409,'no_complaint_needed','Your complaint is already recorded as sent. Review the waiting dates or record what happened.');
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
    let basic: string | null = null;
    if (mode === 'basic') {
      try { basic = basicComplaint(claimed, context); }
      catch (error) {
        if (!(error instanceof DraftPlaceholderError)) throw error;
        throw new HttpError(409, 'basic_facts_unavailable', 'The basic complaint needs a usable merchant, order ID, refund amount and your confirmation that the refund has not arrived. Check your facts first.');
      }
    }
    const answeringModels: string[] = [];
    let issues: TemplateIssue[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const answer = mode === 'basic'
        ? { template: basic!, modelId: null }
        : await deps.generate(claimed, context, attempt === 1, issues);
      if (answer.modelId) answeringModels.push(answer.modelId);
      let issue = mode === 'model' ? templateIssue(answer.template, context) : null;
      const template = mode === 'basic' ? answer.template : assembleComplaint(answer.template, context);
      if (template.length > 20000) issue = 'too_long';
      let rendered;
      try {
        if (issue) throw new DraftPlaceholderError();
        rendered = renderDraft(template, context);
        if (rendered.text.length > 20000) { issue = 'too_long'; throw new DraftPlaceholderError(); }
      } catch (error) {
        if (!(error instanceof DraftPlaceholderError)) throw error;
        issues = [issue ?? 'placeholder_unavailable'];
        if (mode === 'basic') throw new HttpError(409, 'basic_facts_unavailable', 'The basic complaint cannot use these facts yet. Check their values and source labels before preparing it.');
        console.warn('[draft] template rejected', { attempt: attempt + 1, modelId: answer.modelId, issues });
        if (attempt === 0) continue;
        throw new HttpError(
          502,
          'draft_template_invalid',
          `The model could not prepare a draft using your facts. ${issueMessage(issues[0]!)} Your plan is saved. Try again or choose the basic complaint without AI wording.`,
        );
      }
      const flags = lintDraft(rendered.text, { ...context, ignore: rendered.spans });
      const result = await store.save(claimed, {
        template_md: template,
        rendered_md: rendered.text,
        lint: { flags, userStatements: [], generatedOn: context.today, generationKind: mode === 'basic' ? 'code_basic' : 'model', chronologyByCode: true, repairIssues: issues },
        modelId: answer.modelId,
        generationKind: mode === 'basic' ? 'code_basic' : 'model',
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
function issueMessage(issue: TemplateIssue): string {
  return ({ empty:'Its response was empty.',too_long:'Its response was too long.',literal_value:'It typed numbers instead of using the allowed fact placeholders.',date_in_model_prose:'It tried to control date wording that belongs to code.',placeholder_unavailable:'It requested a value your fact sheet cannot supply.' } as const)[issue];
}
