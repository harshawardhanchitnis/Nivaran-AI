import { Injectable, inject } from '@angular/core';
import type { AgentAdvanceResponse, AgentStartResponse } from '@shared/api';
import type { AgentEventRow, AgentRunRow, CaseFactRow, CaseRow, DocumentRow, EvidenceItemRow } from '@shared/database';
import { EVIDENCE_BUCKET } from '@shared/limits';
import { ApiService } from './api.service';
import { SupabaseService } from './supabase.service';
import { pdfPagePreviews } from './pdf-preview';
import { environment } from '../../environments/environment';

export interface WorkspaceRows {
  case: CaseRow; documents: DocumentRow[]; evidence: EvidenceItemRow[]; facts: CaseFactRow[];
  run: AgentRunRow | null; events: AgentEventRow[];
}

@Injectable({ providedIn: 'root' })
export class CaseWorkspaceService {
  private readonly supabase = inject(SupabaseService);
  private readonly api = inject(ApiService);

  async load(caseId: string): Promise<WorkspaceRows> {
    await this.supabase.ensureSignedIn();
    const client = this.supabase.client;
    const caseResult = await client.from('cases').select('*').eq('id', caseId).maybeSingle<CaseRow>();
    if (caseResult.error) throw new Error('Could not load this case. Check your connection and try again.');
    if (!caseResult.data) throw new Error('This case is not available in this browser. Open a case from My cases.');
    const results = await Promise.all([
      client.from('documents').select('*').eq('case_id', caseId).order('label').returns<DocumentRow[]>(),
      client.from('evidence_items').select('*').eq('case_id', caseId).order('created_at').returns<EvidenceItemRow[]>(),
      client.from('case_facts').select('*').eq('case_id', caseId).returns<CaseFactRow[]>(),
      client.from('agent_runs').select('*').eq('case_id', caseId).order('started_at', { ascending: false }).limit(1).returns<AgentRunRow[]>(),
      client.from('agent_events').select('*').eq('case_id', caseId).order('seq').returns<AgentEventRow[]>(),
    ]);
    if (results.some(result => result.error)) throw new Error('Could not load the latest facts. Your saved case is safe; try again.');
    const [documents, evidence, facts, runs, events] = results;
    const run = runs.data?.[0] ?? null;
    return { case: caseResult.data, documents: documents.data ?? [], evidence: evidence.data ?? [],
      facts: facts.data ?? [], run, events: (events.data ?? []).filter(event => event.run_id === run?.id) };
  }

  async start(caseId: string): Promise<AgentRunRow> {
    return (await this.api.post<AgentStartResponse>('agent/start', { caseId })).run;
  }

  advance(run: AgentRunRow): Promise<AgentAdvanceResponse> {
    return this.api.post('agent/advance', { runId: run.id, expectedTurn: run.turn });
  }

  async sourceUrl(document: DocumentRow): Promise<string> {
    const { data, error } = await this.supabase.client.storage.from(EVIDENCE_BUCKET).createSignedUrl(document.storage_path, 600);
    if (error || !data?.signedUrl) throw new Error('Could not open this document. Check your connection and retry.');
    return data.signedUrl;
  }

  pdfPages(url: string, pages: readonly number[]): Promise<Record<number, string>> {
    return pdfPagePreviews(url, pages, environment.supabaseUrl);
  }
}
