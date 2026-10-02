import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentRunRow, CaseFactRow, DocumentRow, EvidenceItemRow, GuidanceRow, QuestionRow } from '../../shared/database.js';
import { HttpError } from '../http.js';
import { createReadingStore } from './store.js';
import { investigationResponseSchema } from './rows.js';
import type { InvestigationStore } from './loop.js';

const unavailable = () => new HttpError(503, 'case_read_failed', 'Could not load or save this case. Please try again.');
export function createInvestigationStore(client: SupabaseClient): InvestigationStore {
  const reading = createReadingStore(client);
  return {
    getRun: reading.getRun, claim: reading.claim, release: reading.release,
    snapshot: async run => {
      const results = await Promise.all([
        client.from('documents').select('*').eq('case_id', run.case_id).order('label').returns<DocumentRow[]>(),
        client.from('evidence_items').select('*').eq('case_id', run.case_id).order('created_at').returns<EvidenceItemRow[]>(),
        client.from('case_facts').select('*').eq('case_id', run.case_id).returns<CaseFactRow[]>(),
        client.from('questions').select('*').eq('run_id', run.id).eq('case_id', run.case_id).order('created_at').returns<QuestionRow[]>(),
      ]);
      if (results.some(result => result.error)) throw unavailable();
      return { documents: results[0].data ?? [], evidence: results[1].data ?? [], facts: results[2].data ?? [], questions: results[3].data ?? [] };
    },
    finishStep: async (run, changes) => {
      const { data, error } = await client.rpc('finish_agent_step', {
        p_run_id: run.id, p_turn: run.turn, p_token: run.processing_token, p_changes: changes,
      });
      if (error) throw unavailable();
      if (data === null) return null;
      const parsed = investigationResponseSchema.safeParse(data);
      if (!parsed.success) throw unavailable();
      return parsed.data;
    },
    searchGuidance: async query => {
      let request = client.from('guidance').select('*').order('id').limit(50);
      if (query.trim()) request = request.textSearch('fts', query, { type: 'websearch', config: 'english' });
      const { data, error } = await request.returns<GuidanceRow[]>();
      if (error) throw unavailable(); return data ?? [];
    },
  };
}
