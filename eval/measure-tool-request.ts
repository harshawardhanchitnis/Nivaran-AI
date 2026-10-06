import {readFile,writeFile} from 'node:fs/promises';
import {generateText} from 'ai';
import {readEnv} from '../server/env.js';
import {getModelById} from '../server/llm/provider.js';
import {agentTools,activeToolNames} from '../server/agent/model.js';
import {INVESTIGATION_PROMPT,investigationContext} from '../server/agent/prompts.js';
import type {EvaluationObservation} from './types.js';
/** Offline SDK serialization only: the transport is replaced, and no caller/key is loaded. */
const observation=JSON.parse(await readFile('eval/results/conflicting-amounts-1.json','utf8')) as EvaluationObservation;
if(!observation.saved)throw new Error('The original saved amount-conflict audit is required.');
const saved=observation.saved,snapshot={documents:saved.documents,evidence:saved.evidence,facts:saved.facts,questions:[]};
const run={...saved.run,agent_steps:0,agent_state:{quotes_checked:true}};
const originalFetch=globalThis.fetch;
const measurements:Array<{tools:string[];schemaBytes:number;inputPayloadBytes:number}>=[];
try {
  globalThis.fetch=async(_input,init)=>{
    const body=JSON.parse(String(init?.body)) as {tools:Array<{function:{name:string}}> ;messages:unknown;response_format?:unknown};
    measurements.push({tools:body.tools.map(t=>t.function.name),schemaBytes:Buffer.byteLength(JSON.stringify(body.tools)),
      inputPayloadBytes:Buffer.byteLength(JSON.stringify({messages:body.messages,tools:body.tools,response_format:body.response_format}))});
    return new Response(JSON.stringify({id:'offline',object:'chat.completion',created:1,model:'qwen/qwen3.8-27b',
      choices:[{index:0,message:{role:'assistant',content:null,tool_calls:[{id:'offline-call',type:'function',function:{name:'ask_user',arguments:JSON.stringify({field:'refund_amount',question:'Which amount?',options:[]})}}]},finish_reason:'tool_calls'}]}),{headers:{'content-type':'application/json'}});
  };
  const model=getModelById('groq','qwen/qwen3.8-27b',readEnv({GROQ_API_KEY:'offline-unused-key'})).model;
  for(const tools of [agentTools(),agentTools(activeToolNames(snapshot,run))])await generateText({model,system:INVESTIGATION_PROMPT,
    prompt:investigationContext(snapshot,run),tools,toolChoice:'required',maxRetries:0,maxOutputTokens:600});
} finally {globalThis.fetch=originalFetch;}
const report={mode:'offline-serialization',sample:'original conflicting-amounts fact sheet',datasetHash:observation.datasetHash,
  fullToolSet:measurements[0],activeToolSet:measurements[1],tokenCount:null,
  tokenCountNote:'Bytes are measured; they are not provider token counts. The rerun records actual prompt_tokens from each Groq response, including tool-choice requests.'};
await writeFile(process.argv[2] ?? 'eval/tool-request-size.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
