import { z } from 'zod';
import type { ToolContext, ToolResult } from './types.js';
export const schema = z.object({ query: z.string().min(1).max(400) });
export async function run(input: z.infer<typeof schema>, context: ToolContext): Promise<ToolResult> {
  const guidance = await context.searchGuidance(input.query);
  // The ladder supplies the required source IDs. A model's broad AND search cannot remove
  // those sources; retrieve missing IDs as rows, still through the caller's checked-row policy.
  const reasons=context.state.next_step?.['reasons'];
  const requiredIds=Array.isArray(reasons)?reasons.flatMap((reason:unknown)=>{
    if(!reason||typeof reason!=='object'||!('guidanceIds'in reason)||!Array.isArray(reason.guidanceIds))return [];
    return reason.guidanceIds.filter((id):id is string=>typeof id==='string');
  }):[];
  for(const id of new Set(requiredIds)) {
    if(guidance.some(row=>row.id===id))continue;
    for(const row of await context.searchGuidance(id))if(!guidance.some(saved=>saved.id===row.id))guidance.push(row);
  }
  return { message: 'Looked for checked guidance.', result: { guidance },
    changes: { state: { ...context.state, checked_guidance: guidance } } };
}
