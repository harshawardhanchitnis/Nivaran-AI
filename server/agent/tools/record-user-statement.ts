import { z } from 'zod';
import { FACT_FIELDS } from '../../../shared/facts.js';
import type { QuestionRow } from '../../../shared/database.js';
import { normaliseFact } from '../../verify/normalise.js';
import type { ToolContext, ToolResult } from './types.js';
export const schema = z.object({ field: z.enum(FACT_FIELDS), value: z.string().min(1).max(4000) });

export function questionAnswer(question: QuestionRow): string | null {
  if (typeof question.answer === 'string') return question.answer.trim() || null;
  if (!question.answer || typeof question.answer !== 'object') return null;
  const answer = question.answer as Record<string, unknown>;
  if (typeof answer['optionId'] === 'string') {
    const option = question.options.find(option => option && typeof option === 'object' && (option as Record<string, unknown>)['id'] === answer['optionId']);
    if (!option || typeof option !== 'object') return null;
    const value = (option as Record<string, unknown>)['value'] ?? (option as Record<string, unknown>)['label'];
    return typeof value === 'string' && value.trim() ? value : null;
  }
  return typeof answer['value'] === 'string' && answer['value'].trim() ? answer['value'] : null;
}

export function run(input: z.infer<typeof schema>, context: ToolContext): ToolResult {
  const matching = context.snapshot.questions.find(question => question.field === input.field && question.answered_at && questionAnswer(question) === input.value);
  if (!matching) throw new Error('This value was not supplied in an answer. Ask the user first.');
  return { message: 'Saved your statement.', result: { field: input.field, status: 'user' }, changes: {
    statement: { field: input.field, value_text: input.value },
    facts: [{ field: input.field, status: 'user', value_text: input.value, value_norm: normaliseFact(input.field, input.value), evidence_item_id: null, confirmed_by_user: true }],
  } };
}
