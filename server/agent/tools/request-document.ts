import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ToolResult } from './types.js';
export const schema = z.object({ kind: z.string().min(1).max(100), reason: z.string().min(1).max(2000) });
export function run(input: z.infer<typeof schema>): ToolResult {
  return { message: `Asked you for ${input.kind}.`, result: { waiting_for_user: true }, changes: {
    status: 'waiting_for_user', question: { id: randomUUID(), kind: 'document_request', field: null,
      prompt: `Please add ${input.kind}. ${input.reason}`, options: [] } } };
}
