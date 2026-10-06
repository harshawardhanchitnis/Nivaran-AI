import { z } from 'zod';
import type { ToolContext, ToolResult } from './types.js';
export const schema = z.object({});
export async function run(_input: z.infer<typeof schema>, context: ToolContext): Promise<ToolResult> {
  const decision = await context.nextStep(context.snapshot.facts);
  const terminal = decision['outcome'] === 'resolved' || decision['outcome'] === 'bank_delay';
  const reasons = decision['reasons'];
  const ids = Array.isArray(reasons) ? reasons.flatMap(reason => reason && typeof reason === 'object' &&
    'guidanceIds' in reason && Array.isArray(reason.guidanceIds) ? reason.guidanceIds.filter((id: unknown): id is string => typeof id === 'string') : []) : [];
  const guidance = [...(context.state.checked_guidance ?? [])];
  if (decision['outcome'] === 'ladder') {
    for (const id of new Set(ids)) {
      if (guidance.some(row => row.id === id)) continue;
      for (const row of await context.searchGuidance(id)) if (!guidance.some(saved => saved.id === row.id)) guidance.push(row);
    }
  }
  return { message: decision['outcome'] === 'resolved' ? 'You recorded that the refund arrived. No complaint is needed.'
    : decision['outcome'] === 'bank_delay' ? 'The merchant states the refund was processed. Take the reference to your bank to trace it.' : 'Worked out the next step from your facts.', result: decision,
    changes: { state: { ...context.state, next_step: decision, checked_guidance: guidance }, ...(terminal ? { status: 'completed', phase: 'done' } : {}) } };
}
