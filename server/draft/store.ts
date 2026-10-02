import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CaseFactRow,
  DocumentRow,
  DraftRow,
  EvidenceItemRow,
  GuidanceRow,
  PlanRow,
} from '../../shared/database.js';
import { HttpError } from '../http.js';
import type { DraftStore } from './write-draft.js';
export interface DraftEditStore extends DraftStore {
  getDraft(id: string): Promise<DraftRow>;
  saveEdit(draft: DraftRow, text: string, lint: Record<string, unknown>): Promise<DraftRow | null>;
}
const unavailable = () =>
  new HttpError(
    503,
    'draft_save_failed',
    'Could not load or save your draft. Your case is safe; try again.',
  );
export function createDraftStore(client: SupabaseClient): DraftEditStore {
  return {
    getPlan: async (id) => {
      const { data, error } = await client
        .from('plans')
        .select('*')
        .eq('id', id)
        .maybeSingle<PlanRow>();
      if (error) throw unavailable();
      if (!data)
        throw new HttpError(404, 'plan_not_found', 'This plan is not available in this browser.');
      return data;
    },
    getDraft: async (id) => {
      const { data, error } = await client
        .from('drafts')
        .select('*')
        .eq('id', id)
        .maybeSingle<DraftRow>();
      if (error) throw unavailable();
      if (!data)
        throw new HttpError(404, 'draft_not_found', 'This draft is not available in this browser.');
      return data;
    },
    existing: async (id) => {
      const { data, error } = await client
        .from('drafts')
        .select('*')
        .eq('plan_id', id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle<DraftRow>();
      if (error) throw unavailable();
      return data;
    },
    claim: async (id) => {
      const { data, error } = await client.rpc('claim_plan_draft', {
        p_plan_id: id,
        p_token: randomUUID(),
      });
      if (error)
        throw new HttpError(
          409,
          'draft_claim_failed',
          error.message.includes('facts have changed')
            ? 'Your facts changed. Get a fresh plan before drafting.'
            : 'Could not start this draft. Your plan is saved; try again.',
        );
      return data as PlanRow | null;
    },
    release: async (plan) => {
      const { error } = await client.rpc('release_plan_draft', {
        p_plan_id: plan.id,
        p_token: plan.draft_claim_token,
      });
      if (error) throw unavailable();
    },
    context: async (plan, today) => {
      const [facts, documents, evidence, guidance] = await Promise.all([
        client.from('case_facts').select('*').eq('case_id', plan.case_id).returns<CaseFactRow[]>(),
        client.from('documents').select('*').eq('case_id', plan.case_id).returns<DocumentRow[]>(),
        client
          .from('evidence_items')
          .select('*')
          .eq('case_id', plan.case_id)
          .returns<EvidenceItemRow[]>(),
        client.from('guidance').select('*').in('id', plan.guidance_ids).returns<GuidanceRow[]>(),
      ]);
      if ([facts, documents, evidence, guidance].some((r) => r.error)) throw unavailable();
      if (
        !plan.guidance_ids.length ||
        plan.guidance_ids.some(
          (id) =>
            !guidance.data?.some(
              (g) =>
                g.id === id &&
                g.checked_on <= today &&
                g.applies_to_steps.includes(plan.ladder_step),
            ),
        )
      )
        throw new HttpError(
          409,
          'guidance_unavailable',
          'Checked guidance for this plan is unavailable. Your case is saved.',
        );
      return {
        facts: facts.data ?? [],
        documents: documents.data ?? [],
        evidence: evidence.data ?? [],
        guidance: guidance.data ?? [],
        dates: plan.dates,
        today,
      };
    },
    save: async (plan, result) => {
      const { data, error } = await client.rpc('finish_plan_draft', {
        p_plan_id: plan.id,
        p_token: plan.draft_claim_token,
        p_result: result,
      });
      if (error) throw unavailable();
      return data as DraftRow | null;
    },
    saveEdit: async (draft, text, lint) => {
      const { data, error } = await client.rpc('save_draft_edit', {
        p_draft_id: draft.id,
        p_text: text,
        p_lint: lint,
      });
      if (error) throw unavailable();
      return data as DraftRow | null;
    },
  };
}
