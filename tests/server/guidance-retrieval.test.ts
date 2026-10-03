import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createInvestigationStore} from '../../server/agent/investigation-store.js';
import {run as searchGuidance} from '../../server/agent/tools/search-guidance.js';
import type {ToolContext} from '../../server/agent/tools/types.js';
const row={id:'ecommerce-grievance-officer',title:'Finding the grievance officer',body:'Checked text',source_name:'Gazette',source_url:'https://example.org',checked_on:'2026-10-02',applies_to_steps:[1]};
describe('checked guidance retrieval',()=>{
  it('looks up the exact recorded source ID as an ID, not missing full-text tokens',async()=>{
    const query={select:vi.fn(),order:vi.fn(),limit:vi.fn(),eq:vi.fn(),textSearch:vi.fn(),returns:vi.fn(async()=>({data:[row],error:null}))};
    for(const method of ['select','order','limit','eq','textSearch'] as const)query[method].mockReturnValue(query);
    const client={from:vi.fn(()=>query)} as unknown as SupabaseClient;
    expect(await createInvestigationStore(client).searchGuidance('ecommerce-grievance-officer')).toEqual([row]);
    expect(query.eq).toHaveBeenCalledWith('id','ecommerce-grievance-officer');expect(query.textSearch).not.toHaveBeenCalled();
  });
  it('retrieves code-required sources when the measured broad query returns no rows',async()=>{
    const search=vi.fn(async(query:string)=>query===row.id?[row]:[]);
    const context={state:{next_step:{outcome:'ladder',step:1,reasons:[{guidanceIds:[row.id]}]}},searchGuidance:search} as unknown as ToolContext;
    const result=await searchGuidance({query:'ecommerce grievance officer overdue refund no complaint sent'},context);
    expect(search.mock.calls).toEqual([['ecommerce grievance officer overdue refund no complaint sent'],[row.id]]);
    expect(result.changes?.state?.checked_guidance).toEqual([row]);
  });
  it('keeps a required source unavailable when caller policy returns none',async()=>{
    const context={state:{next_step:{outcome:'ladder',step:1,reasons:[{guidanceIds:[row.id]}]}},searchGuidance:async()=>[]} as unknown as ToolContext;
    expect((await searchGuidance({query:'refund'},context)).changes?.state?.checked_guidance).toEqual([]);
  });
});
