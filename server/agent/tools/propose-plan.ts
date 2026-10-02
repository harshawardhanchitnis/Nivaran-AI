import { z } from 'zod';
import type { ToolContext, ToolResult } from './types.js';
export const schema = z.object({ summary: z.string().min(1).max(3000), guidance_ids: z.array(z.string().min(1).max(100)).max(6) });
const decisionSchema = z.object({ outcome: z.literal('ladder'), step: z.number().int().min(0).max(3),
  reasons: z.array(z.unknown()), dates: z.record(z.string(), z.string()) });
export async function run(input: z.infer<typeof schema>, context: ToolContext): Promise<ToolResult> {
  const decision = decisionSchema.safeParse(context.state.next_step);
  if (!decision.success) throw new Error('Run get_next_step first. A plan needs a code decision.');
  if (!input.guidance_ids.length) throw new Error('The plan needs checked guidance.');
  const guidance = await context.searchGuidance('');
  if (input.guidance_ids.some(id => !guidance.some(row => row.id === id))) throw new Error('The plan cites guidance that is not available.');
  return { message: 'Prepared a plan for your approval. Nothing has been drafted or sent.', result: { plan_ready: true }, changes: {
    status: 'plan_ready', plan: { ladder_step: decision.data.step, summary: input.summary, reasons: decision.data.reasons,
      dates: decision.data.dates, guidance_ids: [...new Set(input.guidance_ids)] } } };
}
