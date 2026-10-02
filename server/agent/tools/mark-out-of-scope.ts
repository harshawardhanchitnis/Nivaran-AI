import { z } from 'zod';
import type { ToolResult } from './types.js';
export const schema = z.object({ reason: z.string().min(1).max(2000) });
export function run(input: z.infer<typeof schema>): ToolResult {
  return { message: 'This case is outside Nivaran’s refund scope. You can contact the National Consumer Helpline on 1915.',
    result: { reason: input.reason }, changes: { status: 'out_of_scope', phase: 'done' } };
}
