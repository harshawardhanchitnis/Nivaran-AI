import { z } from 'zod';
import type { ToolContext, ToolResult } from './types.js';
export const schema = z.object({ document_id: z.uuid(), question: z.string().min(1).max(2000) });
export function run(input: z.infer<typeof schema>, context: ToolContext): ToolResult {
  const document = context.snapshot.documents.find(document => document.id === input.document_id);
  if (!document) throw new Error('That document is not in this case.');
  return { message: `Taking another look at ${document.label} next.`, result: { queued: true, label: document.label },
    changes: { state: { ...context.state, pending_reread: { ...input, role: 'primary' } } } };
}
