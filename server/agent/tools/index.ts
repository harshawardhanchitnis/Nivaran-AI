import { z } from 'zod';
import * as reread from './reread-document.js';
import * as ask from './ask-user.js';
import * as request from './request-document.js';
import * as statement from './record-user-statement.js';
import * as search from './search-guidance.js';
import * as next from './get-next-step.js';
import * as outside from './mark-out-of-scope.js';
import * as plan from './propose-plan.js';
import type { ToolContext, ToolResult } from './types.js';

export const toolSchemas = {
  reread_document: reread.schema, ask_user: ask.schema, request_document: request.schema,
  record_user_statement: statement.schema, search_guidance: search.schema, get_next_step: next.schema,
  mark_out_of_scope: outside.schema, propose_plan: plan.schema,
};

export async function executeTool(name: string, input: unknown, context: ToolContext): Promise<ToolResult> {
  switch (name) {
    case 'reread_document': return reread.run(reread.schema.parse(input), context);
    case 'ask_user': return ask.run(ask.schema.parse(input), context);
    case 'request_document': return request.run(request.schema.parse(input));
    case 'record_user_statement': return statement.run(statement.schema.parse(input), context);
    case 'search_guidance': return search.run(search.schema.parse(input), context);
    case 'get_next_step': return next.run(next.schema.parse(input), context);
    case 'mark_out_of_scope': return outside.run(outside.schema.parse(input));
    case 'propose_plan': return plan.run(plan.schema.parse(input), context);
    default: throw new z.ZodError([{ code: 'custom', path: ['tool'], message: 'Unknown tool.' }]);
  }
}
