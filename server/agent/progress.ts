import {createHash} from 'node:crypto';
import type {AgentRunRow} from '../../shared/database.js';
import {normaliseFact} from '../../shared/normalise.js';
import {isFactField} from '../../shared/facts.js';
import type {AgentSnapshot} from './tools/types.js';

const canonical=(value:unknown):string=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
  value&&typeof value==='object'?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>`${JSON.stringify(key)}:${canonical(v)}`).join(',')}}`:JSON.stringify(value)??'null';
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
export function progressFor(snapshot:AgentSnapshot,run:AgentRunRow) {
  const facts=hash(snapshot.facts.map(f=>({field:f.field,status:f.status,value:f.value_norm})).sort((a,b)=>a.field.localeCompare(b.field)));
  return run.agent_state.progress?.facts===facts?run.agent_state.progress:{facts,actions:[]};
}
export const toolSignature=(name:string,input:unknown)=>hash({name,
  // Rephrasing a question for the same document is not new progress when facts stayed identical.
  input:name==='reread_document'&&input&&typeof input==='object'&&'document_id'in input?{document_id:input.document_id}:input});
export function conflictAction(snapshot:AgentSnapshot) {
  const conflict=snapshot.facts.find(f=>f.status==='conflict'&&isFactField(f.field));
  if(!conflict||!isFactField(conflict.field))return null;
  const field=conflict.field;
  const values=new Map<string,string>();
  for(const item of snapshot.evidence.filter(e=>e.field===field&&(e.source==='user'||e.quote_verified===true))) {
    const norm=normaliseFact(field,item.value_text);if(norm)values.set(canonical(norm),item.value_text);
  }
  return {name:'ask_user',input:{field,question:`Your sources give different values for ${field.replaceAll('_',' ')}. Which value should we use?`,options:values.size<=6?[...values.values()]:[]}};
}
