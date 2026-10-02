import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake=vi.hoisted(()=>({requireUser:vi.fn(),rpc:vi.fn()}));
vi.mock('../../server/auth.js',()=>({requireUser:fake.requireUser}));
vi.mock('../../server/ladder/dates.js',()=>({indiaToday:()=> '2026-10-02'}));
import { POST } from '../../api/agent/outcome.js';
import { HttpError } from '../../server/http.js';
const id='44444444-4444-4444-8444-444444444444';
const request=(body:unknown)=>new Request('http://localhost/api/agent/outcome',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();fake.requireUser.mockResolvedValue({supabase:{rpc:fake.rpc}});});
describe('recording an outcome',()=>{
  it('requires authentication and a valid refusal reply before writing',async()=>{
    fake.requireUser.mockRejectedValueOnce(new HttpError(401,'unauthenticated','Sign in.'));
    expect((await POST(request({planId:id,requestId:id,outcome:'no_reply'}))).status).toBe(401);
    for(const body of [{planId:id,requestId:id,outcome:'refused'},{planId:id,requestId:id,outcome:'unknown'},{planId:id,requestId:id,outcome:'refunded',replyDocumentId:id}]) expect((await POST(request(body))).status).toBe(400);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it('uses the caller transaction and server date, preserving the saved continuation state',async()=>{
    const run={id,case_id:id,user_id:id,status:'running',phase:'reading',turn:0,agent_steps:0,max_agent_steps:10,model:null,error:null,processing_token:null,processing_started_at:null,reader_state:{},agent_state:{quotes_checked:false,outcome_update:{plan_id:id,request_id:id,outcome:'refused',recorded_on:'2026-10-02',reply_document_id:id}},started_at:'2026-10-02',ended_at:null};
    fake.rpc.mockResolvedValue({data:run,error:null});
    const response=await POST(request({planId:id,requestId:id,outcome:'refused',replyDocumentId:id,today:'2099-01-01'}));
    expect(response.status).toBe(200);expect(await response.json()).toEqual({run});
    expect(fake.rpc).toHaveBeenCalledExactlyOnceWith('record_case_outcome',{p_plan_id:id,p_request_id:id,p_outcome:'refused',p_reply_document_id:id,p_today:'2026-10-02'});
  });
  it('reports a recoverable save failure without leaking database details',async()=>{
    fake.rpc.mockResolvedValue({data:null,error:{message:'private detail'}});
    const response=await POST(request({planId:id,requestId:id,outcome:'no_reply'}));
    expect(response.status).toBe(409);expect(await response.text()).not.toContain('private detail');
  });
});
