import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { FACT_FIELDS } from '../../../shared/facts.js';
import type { ToolContext, ToolResult } from './types.js';
export const schema = z.object({ field: z.enum(FACT_FIELDS), question: z.string().min(1).max(2000), options: z.array(z.string().min(1).max(4000)).max(6) });
export function run(input: z.infer<typeof schema>, context: ToolContext): ToolResult {
  const status = context.snapshot.facts.find(fact => fact.field === input.field)?.status;
  return { message: `Asked you about ${input.field.replaceAll('_', ' ')}.`, result: { waiting_for_user: true },
    changes: { status: 'waiting_for_user', question: { id: randomUUID(), field: input.field,
      kind: status === 'conflict' ? 'conflict' : status === 'missing' ? 'missing' : 'confirm',
      prompt: input.question, options: input.options.map((label, index) => ({ id: `option-${index + 1}`, label, value: label })) } } };
}
