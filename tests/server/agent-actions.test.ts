import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AgentRunRow, CaseFactRow } from '../../shared/database.js';
import type { AgentSnapshot } from '../../server/agent/loop.js';
import { activeToolNames, actionableFields, needsClearerDocument } from '../../server/agent/actions.js';
import { agentTools } from '../../server/agent/model.js';
import { nextStep } from '../../server/ladder/engine.js';
import type { EvaluationObservation } from '../../eval/types.js';

const audit = (id:string) => JSON.parse(readFileSync(`eval/results/final-stage-one/${id}-1.json`,'utf8')) as EvaluationObservation;
const snapshot = (id:string):AgentSnapshot => {const saved=audit(id).saved!;return {documents:saved.documents,evidence:saved.evidence,facts:saved.facts,questions:saved.questions};};
const run = (state:AgentRunRow['agent_state']) => ({agent_state:state,max_agent_steps:10,agent_steps:0}) as AgentRunRow;
describe('useful investigation actions after the measured failures',()=>{
  it('forces a code decision before the optional reference question from not-yet-due',()=>{
    const saved=snapshot('not-yet-due');
    expect(activeToolNames(saved,run({}))).toEqual(['get_next_step','mark_out_of_scope']);
    const decision=nextStep(saved.facts,'2026-10-02');expect(decision.step).toBe(0);
    expect(actionableFields(saved,run({next_step:decision}))).toEqual([]);
    expect(activeToolNames(saved,run({next_step:decision}))).toEqual(['search_guidance']);
  });
  it('makes the actual missing ID actionable before drafting without changing the ladder',()=>{
    const saved=snapshot('missing-order-id');const decision=nextStep(saved.facts,'2026-10-02');
    expect(decision.step).toBe(1);
    expect(actionableFields(saved,run({next_step:decision}))).toContain('order_id');
    expect(activeToolNames(saved,run({next_step:decision}))).toEqual(['ask_user','reread_document','request_document']);
  });
  it('requires a receipt statement when the clean reader omitted that field',()=>{
    const saved=snapshot('clean-overdue');const current=audit('clean-overdue').saved!.run;
    expect(actionableFields(saved,current)).toEqual(['refund_received']);
    expect(Object.keys(agentTools(activeToolNames(saved,current),actionableFields(saved,current)))).toContain('ask_user');
  });
  it('offers a question, not another reread, for an open amount conflict',()=>{
    const saved=snapshot('conflicting-amounts');saved.facts=[{field:'refund_amount',status:'conflict',value_norm:null}] as CaseFactRow[];
    expect(activeToolNames(saved,run({}))).toEqual(['ask_user']);
    expect(actionableFields(saved,run({}))).toEqual(['refund_amount']);
  });
  it('prevents the actual rephrased guidance-search script after loading required guidance',()=>{
    const saved=snapshot('injected-instruction');const current=audit('injected-instruction').saved!.run;
    const queries=saved.questions;expect(queries).toHaveLength(0);
    const observedSearches=audit('injected-instruction').saved!.events.filter(e=>e.type==='tool_call'&&e.payload['tool']==='search_guidance');
    expect(observedSearches.length).toBeGreaterThan(1);
    const scriptedActions=['get_next_step','search_guidance','propose_plan'];
    const scriptedRun=run({});expect(activeToolNames(saved,scriptedRun)).toContain(scriptedActions[0]);
    scriptedRun.agent_state.next_step=current.agent_state.next_step;
    expect(activeToolNames(saved,scriptedRun)).toEqual([scriptedActions[1]]);
    scriptedRun.agent_state.checked_guidance=current.agent_state.checked_guidance;
    expect(activeToolNames(saved,scriptedRun)).toEqual([scriptedActions[2]]);
    for(const ignored of observedSearches.slice(1)) {expect(ignored.payload['input']).toBeTruthy();expect(activeToolNames(saved,scriptedRun)).not.toContain('search_guidance');}
  });
  it('requests a clearer file for the actual unreadable image instead of a date question',()=>{
    expect(activeToolNames(snapshot('unreadable-image'),run({}))).toEqual(['request_document']);
  });
  it('does not request the old failed copy again after a recorded readable replacement',()=>{
    const saved=snapshot('unreadable-image');const newer={...saved.documents[0]!,id:'new',created_at:'2026-10-05T00:00:00Z',read_status:'read' as const};
    saved.documents.push(newer);
    saved.questions.push({...saved.questions[0]!,kind:'document_request',answer:{documentId:'new'},answered_at:newer.created_at});
    expect(needsClearerDocument(saved)).toBe(false);
    newer.read_status='unreadable' as 'read';expect(needsClearerDocument(saved)).toBe(true);
  });
});
