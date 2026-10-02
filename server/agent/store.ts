import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentRunRow, DocumentRow } from '../../shared/database.js';
import { MAX_AGENT_STEPS } from '../../shared/limits.js';
import { HttpError } from '../http.js';
import type { ReadingStore } from './reading.js';
import type { StartReadingStore } from './start.js';
import { agentRunSchema, readingResponseSchema } from './rows.js';

function storeError() {
  return new HttpError(503, 'case_read_failed', 'Could not load or save this case. Please try again.');
}

/** Every query and RPC uses requireUser's client, with the caller's RLS policies. */
export function createReadingStore(supabase: SupabaseClient): ReadingStore & StartReadingStore {
  return {
    requireCase: async (id) => {
      const { data, error } = await supabase.from('cases').select('id').eq('id', id).maybeSingle();
      if (error) throw storeError();
      if (!data) throw new HttpError(404, 'case_not_found', 'This case could not be found.');
    },
    activeRun: async (caseId) => {
      const { data, error } = await supabase.from('agent_runs').select('*').eq('case_id', caseId)
        .in('status', ['running', 'waiting_for_user', 'plan_ready']).maybeSingle<AgentRunRow>();
      if (error) throw storeError();
      return data;
    },
    hasDocuments: async (caseId) => {
      const { count, error } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('case_id', caseId);
      if (error) throw storeError();
      return (count ?? 0) > 0;
    },
    insertRun: async (caseId) => {
      const { data, error } = await supabase.from('agent_runs').insert({ case_id: caseId, max_agent_steps: MAX_AGENT_STEPS })
        .select('*').single<AgentRunRow>();
      if (error) throw error;
      if (!data) throw storeError();
      return data;
    },
    getRun: async (id) => {
      const { data, error } = await supabase.from('agent_runs').select('*').eq('id', id).maybeSingle<AgentRunRow>();
      if (error) throw storeError();
      if (!data) throw new HttpError(404, 'run_not_found', 'This reading session could not be found.');
      const parsed = agentRunSchema.safeParse(data);
      if (!parsed.success) throw storeError();
      return parsed.data;
    },
    claim: async (id, turn) => {
      const { data, error } = await supabase.rpc('claim_agent_turn', { p_run_id: id, p_turn: turn, p_token: randomUUID() });
      if (error) throw storeError();
      if (data === null) return null;
      const parsed = agentRunSchema.safeParse(data);
      if (!parsed.success) throw storeError();
      return parsed.data;
    },
    release: async (run) => {
      const { error } = await supabase.rpc('release_agent_turn', {
        p_run_id: run.id, p_turn: run.turn, p_token: run.processing_token,
      });
      if (error) throw storeError();
    },
    pendingDocument: async (caseId, fallbackId) => {
      let query = supabase.from('documents').select('*').eq('case_id', caseId).eq('read_status', 'pending');
      if (fallbackId) query = query.eq('id', fallbackId);
      const { data, error } = await query.order('label', { ascending: true }).limit(1).maybeSingle<DocumentRow>();
      if (error) throw storeError();
      return data;
    },
    finish: async (input) => {
      const { data, error } = await supabase.rpc('finish_agent_reading', {
        p_run_id: input.run.id, p_turn: input.run.turn, p_token: input.run.processing_token,
        p_document_id: input.documentId,
        p_result: input.result ? { doc_type: input.result.docType, readable: input.result.readable, facts: input.result.facts } : null,
        p_read_status: input.readStatus, p_reader_state: input.readerState, p_event: input.event, p_model: input.model,
      });
      if (error) throw storeError();
      if (data === null) return null;
      const parsed = readingResponseSchema.safeParse(data);
      if (!parsed.success) throw storeError();
      return parsed.data;
    },
  };
}
