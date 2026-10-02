import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRunRow, CaseFactRow } from '../../shared/database.js';
import { HttpError } from '../../server/http.js';
import { advanceInvestigation, type AgentSnapshot, type InvestigationChanges, type InvestigationDependencies, type InvestigationStore } from '../../server/agent/loop.js';

describe('one model-chosen investigation step', () => {
  let run: AgentRunRow; let snapshot: AgentSnapshot;
  const claim = vi.fn(); const release = vi.fn(); const finishStep = vi.fn();
  const choose = vi.fn(); const charge = vi.fn(); const check = vi.fn(); const reread = vi.fn(); const nextStep = vi.fn();
  let store: InvestigationStore; let deps: InvestigationDependencies;
  beforeEach(() => {
    vi.resetAllMocks();
    run = { id: '11111111-1111-4111-8111-111111111111', case_id: '22222222-2222-4222-8222-222222222222',
      user_id: 'owner', status: 'running', phase: 'investigating', turn: 0, agent_steps: 0, max_agent_steps: 10,
      agent_state: { quotes_checked: true }, reader_state: {}, processing_token: null, processing_started_at: null,
      model: null, error: null, started_at: '', ended_at: null };
    snapshot = { documents: [], evidence: [], facts: [], questions: [] };
    claim.mockImplementation(async () => ({ ...run, processing_token: 'claimed' })); release.mockResolvedValue(undefined);
    finishStep.mockImplementation(async (_run: AgentRunRow, changes: InvestigationChanges) => {
      run = { ...run, turn: run.turn + 1, agent_steps: run.agent_steps + (changes.count_step ? 1 : 0),
        status: changes.status ?? 'running', agent_state: changes.state ?? run.agent_state, processing_token: null };
      if (changes.question) snapshot.questions.push({ ...changes.question, run_id: run.id, case_id: run.case_id, user_id: run.user_id, answer: null, answered_at: null, created_at: '' });
      return { run, events: [], ...(changes.question ? { question: snapshot.questions.at(-1) } : {}) };
    });
    choose.mockResolvedValue({ name: 'get_next_step', input: {} });
    charge.mockResolvedValue(undefined); check.mockResolvedValue({ evidence: [], facts: [] });
    nextStep.mockResolvedValue({ outcome: 'ladder', step: 1, reasons: [], dates: { refund_due: '2026-09-24' } });
    store = { getRun: async () => run, claim, release, snapshot: async () => snapshot, finishStep,
      searchGuidance: async () => [{ id: 'checked-rule', title: 'Checked rule', body: 'Test', source_name: 'Test', source_url: 'https://example.org', checked_on: '2026-10-02', applies_to_steps: [1] }] };
    deps = { choose, charge, check, reread, nextStep };
  });

  it('runs get_next_step, then proposes a plan on the next request', async () => {
    await advanceInvestigation(store, deps, run.id, 0);
    expect(choose).toHaveBeenCalledTimes(1); expect(charge).toHaveBeenCalledTimes(1); expect(nextStep).toHaveBeenCalledTimes(1);
    choose.mockResolvedValue({ name: 'propose_plan', input: { summary: 'Ask for the refund.', guidance_ids: ['checked-rule'] } });
    await advanceInvestigation(store, deps, run.id, 1);
    expect(run.status).toBe('plan_ready'); expect(run.agent_steps).toBe(2);
    expect(finishStep.mock.calls[1]?.[1]).toMatchObject({ plan: { ladder_step: 1, dates: { refund_due: '2026-09-24' } } });
    expect(charge.mock.invocationCallOrder[0]).toBeLessThan(choose.mock.invocationCallOrder[0]!);
  });
  it('pauses for a conflict, resumes its actual answer without another model call', async () => {
    snapshot.facts = [{ field: 'refund_amount', status: 'conflict' }] as CaseFactRow[];
    choose.mockResolvedValue({ name: 'ask_user', input: { field: 'refund_amount', question: 'Which is right?', options: ['9999', '8999'] } });
    await advanceInvestigation(store, deps, run.id, 0);
    expect(run.status).toBe('waiting_for_user');
    const question = snapshot.questions[0]!; question.answer = { optionId: 'option-2' }; question.answered_at = '2026-10-02';
    await advanceInvestigation(store, deps, run.id, 1);
    expect(choose).toHaveBeenCalledTimes(1);
    expect(finishStep.mock.calls[1]?.[1]).toMatchObject({ status: 'running', statement: { field: 'refund_amount', value_text: '8999' },
      facts: [expect.objectContaining({ status: 'user', confirmed_by_user: true })] });
  });
  it('queues a reread and reads it on a separate request before asking about a gap', async () => {
    snapshot.documents = [{ id: '33333333-3333-4333-8333-333333333333', mime_type: 'application/pdf', label: 'E01' }] as AgentSnapshot['documents'];
    choose.mockResolvedValue({ name: 'reread_document', input: { document_id: snapshot.documents[0]!.id, question: 'Is an order ID stated?' } });
    await advanceInvestigation(store, deps, run.id, 0);
    expect(reread).not.toHaveBeenCalled();
    reread.mockResolvedValue({ docType: 'invoice', readable: true, facts: [] });
    await advanceInvestigation(store, deps, run.id, 1);
    expect(choose).toHaveBeenCalledTimes(1); expect(reread).toHaveBeenCalledTimes(1);
    expect(run.agent_state.quotes_checked).toBe(false);
    run.agent_state.quotes_checked = true;
    choose.mockResolvedValue({ name: 'ask_user', input: { field: 'order_id', question: 'What is the order ID?', options: [] } });
    await advanceInvestigation(store, deps, run.id, 2); expect(run.status).toBe('waiting_for_user');
  });
  it('ends an out-of-scope case without a plan', async () => {
    choose.mockResolvedValue({ name: 'mark_out_of_scope', input: { reason: 'This is a bank transfer dispute.' } });
    await advanceInvestigation(store, deps, run.id, 0);
    expect(run.status).toBe('out_of_scope'); expect(finishStep.mock.calls[0]?.[1]).not.toHaveProperty('plan');
  });
  it('stops at the step ceiling without spending another call', async () => {
    run.agent_steps = 10; await advanceInvestigation(store, deps, run.id, 0);
    expect(choose).not.toHaveBeenCalled(); expect(charge).not.toHaveBeenCalled(); expect(run.status).toBe('failed');
  });
  it('records invalid input as an error and counts the chosen step', async () => {
    choose.mockResolvedValue({ name: 'ask_user', input: { field: 'unsupported', question: 'Which?', options: [] } });
    await advanceInvestigation(store, deps, run.id, 0);
    expect(run.agent_steps).toBe(1); expect(finishStep.mock.calls[0]?.[1]).toMatchObject({ events: [expect.objectContaining({ type: 'tool_call' }), expect.objectContaining({ type: 'error' })] });
  });
  it('confirms quotes before any tool-using call, using its own request', async () => {
    run.agent_state.quotes_checked = false;
    await advanceInvestigation(store, deps, run.id, 0);
    expect(check).toHaveBeenCalledTimes(1); expect(choose).not.toHaveBeenCalled(); expect(charge).not.toHaveBeenCalled();
    expect(run.agent_state.quotes_checked).toBe(true);
  });
  it('refuses a charge without bumping the turn', async () => {
    charge.mockRejectedValue(new HttpError(429, 'quota_exhausted', 'Daily limit reached.'));
    await expect(advanceInvestigation(store, deps, run.id, 0)).rejects.toMatchObject({ code: 'quota_exhausted' });
    expect(choose).not.toHaveBeenCalled(); expect(finishStep).not.toHaveBeenCalled(); expect(release).toHaveBeenCalled();
  });
  it('preserves the run when the routed chooser refuses logical charging', async () => {
    delete deps.charge;
    choose.mockRejectedValue(new HttpError(429, 'quota_exhausted', 'Daily limit reached.'));
    await expect(advanceInvestigation(store, deps, run.id, 0)).rejects.toMatchObject({ code: 'quota_exhausted' });
    expect(finishStep).not.toHaveBeenCalled(); expect(release).toHaveBeenCalledTimes(1);
    expect(run.turn).toBe(0); expect(run.agent_steps).toBe(0);
  });
  it('waits for the latest question instead of reusing an older answer', async () => {
    snapshot.questions = [
      { id: 'old', field: 'order_id', answer: 'MM-01', answered_at: '2026-10-02' },
      { id: 'new', field: 'refund_amount', answer: null, answered_at: null },
    ] as AgentSnapshot['questions'];
    run.status = 'waiting_for_user';
    await advanceInvestigation(store, deps, run.id, 0);
    expect(claim).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled();
  });
  it('persists the checked guidance search for the next request', async () => {
    choose.mockResolvedValue({ name: 'search_guidance', input: { query: 'refund' } });
    await advanceInvestigation(store, deps, run.id, 0);
    expect(run.agent_state.checked_guidance?.[0]?.id).toBe('checked-rule');
  });
  it('keeps its claim until the atomic commit has completed', async () => {
    finishStep.mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(release).not.toHaveBeenCalled();
      return { run: { ...run, turn: 1 }, events: [] };
    });
    await advanceInvestigation(store, deps, run.id, 0);
    expect(release).not.toHaveBeenCalled();
  });
  it('does not treat a failed save as a provider error or attempt a second save', async () => {
    run.agent_state.quotes_checked = false;
    finishStep.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(advanceInvestigation(store, deps, run.id, 0)).rejects.toThrow('Database unavailable');
    expect(finishStep).toHaveBeenCalledTimes(1); expect(release).toHaveBeenCalledTimes(1);
  });
  it('cannot invent a user statement or propose a plan without a code decision', async () => {
    choose.mockResolvedValue({ name: 'record_user_statement', input: { field: 'refund_amount', value: '9999' } });
    await advanceInvestigation(store, deps, run.id, 0);
    expect(finishStep.mock.calls[0]?.[1]).not.toHaveProperty('statement');
    choose.mockResolvedValue({ name: 'propose_plan', input: { summary: 'Send it.', guidance_ids: ['checked-rule'] } });
    await advanceInvestigation(store, deps, run.id, 1); expect(run.status).toBe('running');
    expect(finishStep.mock.calls[1]?.[1]).not.toHaveProperty('plan');
  });
});
