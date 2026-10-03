import { generateText, jsonSchema, tool, type JSONSchema7 } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRoutedModelCall } from '../llm/routed-call.js';
import { INVESTIGATION_PROMPT, investigationContext } from './prompts.js';
import { toolSchemas } from './tools/index.js';
import type { AgentSnapshot, InvestigationDependencies } from './loop.js';
import type { AgentRunRow } from '../../shared/database.js';

const descriptions: Record<keyof typeof toolSchemas, string> = {
  reread_document: 'Queue a targeted second look at an owned document for a missing fact.',
  ask_user: 'Ask about a missing, conflicting or unconfirmed field and pause.',
  request_document: 'Ask for a missing or clearer document and pause.',
  record_user_statement: 'Store an exact value from an actual answered question as Your statement.',
  search_guidance: 'Search only the human-checked guidance rows.',
  get_next_step: 'Ask the code ladder for the next step, reasons and dates.',
  mark_out_of_scope: 'Stop a case outside online owed-refund scope.',
  propose_plan: 'Propose a plan from the saved code decision and checked guidance, awaiting approval.',
};

/** No execute functions: generateText cannot run tools or start a second model step. */
export function activeToolNames(snapshot:AgentSnapshot,run:AgentRunRow):Array<keyof typeof toolSchemas> {
  if(snapshot.facts.some(f=>f.status==='conflict'))return ['ask_user','reread_document'];
  const decision=run.agent_state.next_step;
  if(decision?.['outcome']==='needs_input')return ['ask_user','reread_document','request_document'];
  if(decision?.['outcome']==='ladder')return run.agent_state.checked_guidance?.length?['propose_plan','search_guidance']:['search_guidance'];
  return ['get_next_step','ask_user','reread_document','request_document','mark_out_of_scope'];
}
export function agentTools(names:ReadonlyArray<keyof typeof toolSchemas>=Object.keys(toolSchemas) as Array<keyof typeof toolSchemas>) {
  // Providers receive portable schemas; executeTool enforces all strict Zod bounds locally.
  const omit = new Set(['$schema', 'minLength', 'maxLength', 'minItems', 'maxItems', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'format']);
  const portable = (value: unknown): unknown => Array.isArray(value) ? value.map(portable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([key]) => !omit.has(key)).map(([key, item]) => [key, portable(item)])) : value;
  return Object.fromEntries(Object.entries(toolSchemas).filter(([name])=>names.includes(name as keyof typeof toolSchemas)).map(([name, schema]) =>
    [name, tool({ description: descriptions[name as keyof typeof toolSchemas], inputSchema: jsonSchema<unknown>(portable(z.toJSONSchema(schema)) as JSONSchema7) })]));
}
export function createAgentToolChooser(client:SupabaseClient):InvestigationDependencies['choose'] {
  const route=createRoutedModelCall(client);
  return async (snapshot,run)=> {
  const tools = agentTools(activeToolNames(snapshot,run));
  const result=await route('text',async (selected,signal)=> {
  const response = await generateText({ model: selected.model, system: INVESTIGATION_PROMPT,
    prompt: investigationContext(snapshot, run), tools, toolChoice: 'required',
    maxRetries: 0, maxOutputTokens: 600, abortSignal: signal,
  });
  if (response.toolCalls.length !== 1) throw new Error('The model must choose exactly one tool.');
  const call = response.toolCalls[0]!;
  return { name: call.toolName, input: call.input };
  });
  return {...result.value,modelId:result.modelId};
  };
}
