import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRunRow, QuestionRow } from '../../shared/database.js';
import { answerQuestion, type QuestionStore } from '../../server/agent/answer-question.js';
import type { InvestigationDependencies } from '../../server/agent/loop.js';
const resume = vi.hoisted(() => vi.fn());
vi.mock('../../server/agent/loop.js', () => ({ advanceInvestigation: resume }));
describe('saved question answers', () => {
  let question: QuestionRow; let store: QuestionStore;
  const save = vi.fn(); const run = { id: 'run', turn: 4, status: 'waiting_for_user' } as AgentRunRow;
  beforeEach(() => {
    vi.resetAllMocks();
    question = { id: 'q', run_id: 'run', options: [{ id: 'option-1', label: '9999', value: '9999' }], answer: null, answered_at: null } as QuestionRow;
    store = { getQuestion: async () => question, saveAnswer: save,
      getRun: async () => run, snapshot: async () => ({ documents: [], evidence: [], facts: [], questions: [question] }) } as unknown as QuestionStore;
    save.mockResolvedValue(true); resume.mockResolvedValue({ run: { ...run, status: 'running', turn: 5 }, events: [] });
  });
  it('saves an offered choice and resumes the same run', async () => {
    const result = await answerQuestion(store, {} as InvestigationDependencies, { questionId: 'q', answer: { optionId: 'option-1' } });
    expect(save).toHaveBeenCalledWith(question, { optionId: 'option-1' });
    expect(resume).toHaveBeenCalledWith(store, {}, 'run', 4); expect(result.run.status).toBe('running');
  });
  it('rejects an invented choice and free text when options exist', async () => {
    await expect(answerQuestion(store, {} as InvestigationDependencies, { questionId: 'q', answer: { optionId: 'missing' } })).rejects.toMatchObject({ code: 'answer_invalid' });
    await expect(answerQuestion(store, {} as InvestigationDependencies, { questionId: 'q', answer: 'other' })).rejects.toMatchObject({ code: 'answer_invalid' });
    expect(save).not.toHaveBeenCalled();
  });
  it('allows trimmed text only when the question needs it', async () => {
    question.options = [];
    await answerQuestion(store, {} as InvestigationDependencies, { questionId: 'q', answer: '  MM-001  ' });
    expect(save).toHaveBeenCalledWith(question, 'MM-001');
  });
  it('does not overwrite an answer or answer a superseded question', async () => {
    save.mockResolvedValue(false);
    await expect(answerQuestion(store, {} as InvestigationDependencies, { questionId: 'q', answer: { optionId: 'option-1' } })).rejects.toMatchObject({ code: 'answer_changed' });
    store.snapshot = async () => ({ documents: [], evidence: [], facts: [], questions: [question, { ...question, id: 'new' }] });
    await expect(answerQuestion(store, {} as InvestigationDependencies, { questionId: 'q', answer: { optionId: 'option-1' } })).rejects.toMatchObject({ code: 'question_closed' });
    expect(resume).not.toHaveBeenCalled();
  });
});
