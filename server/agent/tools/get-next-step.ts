import { z } from 'zod';
import type { ToolContext, ToolResult } from './types.js';
export const schema = z.object({});
export async function run(_input: z.infer<typeof schema>, context: ToolContext): Promise<ToolResult> {
  const decision = await context.nextStep(context.snapshot.facts);
  const terminal = decision['outcome'] === 'resolved' || decision['outcome'] === 'bank_delay';
  return { message: decision['outcome'] === 'resolved' ? 'You recorded that the refund arrived. No complaint is needed.'
    : decision['outcome'] === 'bank_delay' ? 'The merchant states the refund was processed. Take the reference to your bank to trace it.' : 'Worked out the next step from your facts.', result: decision,
    changes: { state: { ...context.state, next_step: decision }, ...(terminal ? { status: 'completed', phase: 'done' } : {}) } };
}
