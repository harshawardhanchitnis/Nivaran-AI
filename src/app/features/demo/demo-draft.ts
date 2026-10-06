import type { DraftRow, PlanRow } from '@shared/database';
import type { DraftRenderContext } from '@shared/draft-render';
import { renderDraft } from '@shared/draft-render';
import { basicComplaint } from '@shared/draft-template';
import { normaliseFact } from '@shared/normalise';
import { lintDraft } from '@shared/draft-lint';
import type { FactView } from '../../shared/ui/models';

/** Invented visual data only. Uses the real renderer/linter; never touches auth, API or storage. */
export function demoDraftContext(facts: readonly FactView[]): DraftRenderContext {
  return { today:'2026-10-02',dates:{refund_due:'2026-09-09'},
    facts: facts.map(f => ({field:f.field,status:f.status,value_text:f.value,value_norm:f.value ? normaliseFact(f.field,f.value) : null,evidence_item_id:f.status === 'document' ? f.field : null})),
    evidence: facts.filter(f => f.status === 'document' && f.sources[0]).map(f => ({id:f.field,source:'document',document_id:f.sources[0]!.evidence})),
    documents: ['E01','E02','E03'].map(label => ({id:label,label})) };
}
export function demoBasicDraft(context: DraftRenderContext): DraftRow {
  const template = basicComplaint({ladder_step:1} as PlanRow, context);
  const rendered = renderDraft(template, context);
  return {id:'demo-draft',case_id:'demo',user_id:'demo',plan_id:'demo-plan',kind:'grievance_officer',version:1,
    template_md:template,rendered_md:rendered.text,lint:{generationKind:'code_basic',userStatements:[],generatedOn:context.today,flags:lintDraft(rendered.text,{...context,ignore:rendered.spans})},edited_by_user:false,created_at:'2026-10-02'};
}
