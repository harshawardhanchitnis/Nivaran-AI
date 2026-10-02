import { z } from 'zod';
import type { ToolContext, ToolResult } from './types.js';
export const schema = z.object({});
export async function run(_input: z.infer<typeof schema>, context: ToolContext): Promise<ToolResult> {
  const decision = await context.nextStep(context.snapshot.facts);
  return { message: 'Worked out the next step from your facts.', result: decision,
    changes: { state: { ...context.state, next_step: decision } } };
}
