import type { AgentAdvanceResponse, AgentAnswerRequest } from '../../shared/api.js';
import type { QuestionRow } from '../../shared/database.js';
import { HttpError } from '../http.js';
import { advanceInvestigation, type InvestigationStore, type InvestigationDependencies } from './loop.js';

export interface QuestionStore extends InvestigationStore {
  getQuestion(id: string): Promise<QuestionRow>;
  saveAnswer(question: QuestionRow, answer: AgentAnswerRequest['answer']): Promise<boolean>;
}
/** A conditional answer save followed by the zero-model resume step. */
export async function answerQuestion(store: QuestionStore, deps: InvestigationDependencies, input: AgentAnswerRequest): Promise<AgentAdvanceResponse> {
  const question = await store.getQuestion(input.questionId);
  const run = await store.getRun(question.run_id);
  const snapshot = await store.snapshot(run);
  if (run.status !== 'waiting_for_user' || snapshot.questions.at(-1)?.id !== question.id)
    throw new HttpError(409, 'question_closed', 'This question is no longer open. Refresh your case.');
  const answer = typeof input.answer === 'string' ? input.answer.trim() : input.answer;
  const valid = typeof answer === 'string' ? question.options.length === 0 && answer.length > 0 && answer.length <= 4000
    : question.options.some(option => option && typeof option === 'object' && 'id' in option && option.id === answer.optionId);
  if (!valid) throw new HttpError(400, 'answer_invalid', 'Please choose one of the options or enter the requested answer.');
  if (!await store.saveAnswer(question, answer)) throw new HttpError(409, 'answer_changed', 'An answer was already saved. Refresh your case to continue.');
  return advanceInvestigation(store, deps, run.id, run.turn);
}
