import { z } from 'zod';
import type { ToolContext, ToolResult } from './types.js';
import { indiaToday } from '../../ladder/dates.js';
import { normaliseDate } from '../../../shared/normalise.js';
export const schema = z.object({ summary: z.string().min(1).max(3000), guidance_ids: z.array(z.string().min(1).max(100)).max(6) });
const decisionSchema = z.object({ outcome: z.literal('ladder'), step: z.number().int().min(0).max(3),
  reasons: z.array(z.unknown()), dates: z.record(z.string(), z.string()), notes: z.array(z.string()).default([]) });
export async function run(input: z.infer<typeof schema>, context: ToolContext): Promise<ToolResult> {
  const decision = decisionSchema.safeParse(context.state.next_step);
  if (!decision.success) throw new Error('Run get_next_step first. A plan needs a code decision.');
  if (!input.guidance_ids.length) throw new Error('The plan needs checked guidance.');
  const guidance = await context.searchGuidance('');
  const today = decision.data.dates['today'] ?? indiaToday();
  if (input.guidance_ids.some(id => !guidance.some(row => row.id === id && row.applies_to_steps.includes(decision.data.step)
    && normaliseDate(row.checked_on) === row.checked_on && row.checked_on <= today))) throw new Error('The plan cites guidance that is not available for this step.');
  const requiredIds = decision.data.reasons.flatMap(reason => {
    if (!reason || typeof reason !== 'object' || !('guidanceIds' in reason) || !Array.isArray(reason.guidanceIds)) return [];
    return reason.guidanceIds.filter((id): id is string => typeof id === 'string');
  });
  if (requiredIds.some(id => !input.guidance_ids.includes(id))) throw new Error('The plan must cite the guidance required by the code decision.');
  return { message: 'Prepared a plan for your approval. Nothing has been drafted or sent.', result: { plan_ready: true }, changes: {
    status: 'plan_ready', plan: { ladder_step: decision.data.step, summary: input.summary, reasons: [...decision.data.reasons, ...decision.data.notes.map(text => ({ code: 'calculation_note', text }))],
      dates: decision.data.dates, guidance_ids: [...new Set(input.guidance_ids)] } } };
}
