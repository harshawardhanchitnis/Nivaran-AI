import { Injectable, inject } from '@angular/core';
import type {
  AgentAdvanceResponse,
  AgentStartResponse,
  AgentAnswerRequest,
  AgentDraftResponse,
  AgentDraftEditRequest,
  RecordOutcomeRequest,
} from '@shared/api';
import type {
  AgentEventRow,
  AgentRunRow,
  CaseFactRow,
  CaseRow,
  DocumentRow,
  DraftRow,
  SentPlanResult,
  EvidenceItemRow,
  GuidanceRow,
  PlanRow,
  QuestionRow,
} from '@shared/database';
import { EVIDENCE_BUCKET } from '@shared/limits';
import { ApiService } from './api.service';
import { SupabaseService } from './supabase.service';
import { pdfPagePreviews } from './pdf-preview';
import { environment } from '../../environments/environment';

export interface WorkspaceRows {
  case: CaseRow;
  documents: DocumentRow[];
  evidence: EvidenceItemRow[];
  facts: CaseFactRow[];
  run: AgentRunRow | null;
  events: AgentEventRow[];
  questions: QuestionRow[];
  plan: PlanRow | null;
  guidance: GuidanceRow[];
  draft: DraftRow | null;
  sentComplaint: PlanRow | null;
}

@Injectable({ providedIn: 'root' })
export class CaseWorkspaceService {
  private readonly supabase = inject(SupabaseService);
  private readonly api = inject(ApiService);

  async resumeDocumentReading(caseId: string, documentId: string): Promise<AgentRunRow> {
    await this.supabase.ensureSignedIn();
    const {data,error} = await this.supabase.client.rpc('resume_document_reading',{p_case_id:caseId,p_document_id:documentId});
    if (error || !data) throw new Error('Your new file is saved, but reading could not resume. Retry without uploading again.');
    return data as AgentRunRow;
  }

  async load(caseId: string): Promise<WorkspaceRows> {
    await this.supabase.ensureSignedIn();
    const client = this.supabase.client;
    const caseResult = await client
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .maybeSingle<CaseRow>();
    if (caseResult.error)
      throw new Error('Could not load this case. Check your connection and try again.');
    if (!caseResult.data)
      throw new Error('This case is not available in this browser. Open a case from My cases.');
    const results = await Promise.all([
      client
        .from('documents')
        .select('*')
        .eq('case_id', caseId)
        .order('label')
        .returns<DocumentRow[]>(),
      client
        .from('evidence_items')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at')
        .returns<EvidenceItemRow[]>(),
      client.from('case_facts').select('*').eq('case_id', caseId).returns<CaseFactRow[]>(),
      client
        .from('agent_runs')
        .select('*')
        .eq('case_id', caseId)
        .order('started_at', { ascending: false })
        .limit(1)
        .returns<AgentRunRow[]>(),
      client
        .from('agent_events')
        .select('*')
        .eq('case_id', caseId)
        .order('seq')
        .returns<AgentEventRow[]>(),
      client
        .from('questions')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at')
        .returns<QuestionRow[]>(),
      client
        .from('plans')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .returns<PlanRow[]>(),
      client.from('guidance').select('*').order('id').returns<GuidanceRow[]>(),
      client
        .from('drafts')
        .select('*')
        .eq('case_id', caseId)
        .order('version', { ascending: false })
        .returns<DraftRow[]>(),
    ]);
    if (results.some((result) => result.error))
      throw new Error('Could not load the latest facts. Your saved case is safe; try again.');
    const [documents, evidence, facts, runs, events, questions, plans, guidance, drafts] = results;
    const run = runs.data?.[0] ?? null;
    const plan = (plans.data ?? []).find((plan) => plan.run_id === run?.id) ?? null;
    return {
      case: caseResult.data,
      documents: documents.data ?? [],
      evidence: evidence.data ?? [],
      facts: facts.data ?? [],
      run,
      events: (events.data ?? []).filter((event) => event.run_id === run?.id),
      questions: (questions.data ?? []).filter((question) => question.run_id === run?.id),
      plan,
      guidance: guidance.data ?? [],
      sentComplaint: (plans.data ?? []).find(p => p.ladder_step === 1 && p.approved_at && !p.rejected_at && p.sent_on && (drafts.data ?? []).some(d => d.plan_id === p.id)) ?? null,
      draft:
        plan?.approved_at && !plan.rejected_at
          ? ((drafts.data ?? []).find((draft) => draft.plan_id === plan.id) ?? null)
          : null,
    };
  }

  async start(caseId: string): Promise<AgentRunRow> {
    return (await this.api.post<AgentStartResponse>('agent/start', { caseId })).run;
  }

  advance(run: AgentRunRow): Promise<AgentAdvanceResponse> {
    return this.api.post('agent/advance', { runId: run.id, expectedTurn: run.turn });
  }
  answer(questionId: string, answer: AgentAnswerRequest['answer']): Promise<AgentAdvanceResponse> {
    return this.api.post('agent/answer', { questionId, answer });
  }
  prepareDraft(planId: string): Promise<AgentDraftResponse> {
    return this.api.post('agent/draft', { planId });
  }
  markSent(planId: string, sentOn: string): Promise<SentPlanResult> {
    return this.api.post('agent/sent', { planId, sentOn });
  }
  recordOutcome(input: RecordOutcomeRequest): Promise<AgentStartResponse> {
    return this.api.post('agent/outcome',input);
  }
  saveDraftEdit(input: AgentDraftEditRequest): Promise<{ draft: DraftRow }> {
    return this.api.post('agent/draft-edit', input);
  }
  async reviewPlan(planId: string, action: 'approve' | 'reject' | 'change'): Promise<void> {
    await this.supabase.ensureSignedIn();
    const { data, error } = await this.supabase.client.rpc('review_plan', {
      p_plan_id: planId,
      p_action: action,
    });
    if (error)
      throw new Error(
        error.message.includes('facts have changed')
          ? 'Your facts changed. Request a change to this plan before approving.'
          : 'Could not save your plan decision. Your case is safe; try again.',
      );
    if (!data)
      throw new Error(
        'This plan has already changed. Reload your case to see the latest decision.',
      );
  }

  async sourceUrl(document: DocumentRow): Promise<string> {
    const { data, error } = await this.supabase.client.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(document.storage_path, 600);
    if (error || !data?.signedUrl)
      throw new Error('Could not open this document. Check your connection and retry.');
    return data.signedUrl;
  }

  pdfPages(url: string, pages: readonly number[]): Promise<Record<number, string>> {
    return pdfPagePreviews(url, pages, environment.supabaseUrl);
  }
}
