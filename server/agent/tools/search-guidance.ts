import { z } from 'zod';
import type { ToolContext, ToolResult } from './types.js';
export const schema = z.object({ query: z.string().min(1).max(400) });
export async function run(input: z.infer<typeof schema>, context: ToolContext): Promise<ToolResult> {
  const guidance = await context.searchGuidance(input.query);
  return { message: 'Looked for checked guidance.', result: { guidance },
    changes: { state: { ...context.state, checked_guidance: guidance } } };
}
