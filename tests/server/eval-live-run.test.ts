import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {AgentRunRow,PlanRow,QuestionRow} from '../../shared/database.js';
import type {EvalCase} from '../../eval/types.js';
const mock=vi.hoisted(()=>({run:{} as AgentRunRow,snapshot:vi.fn(),getRun:vi.fn(),reading:vi.fn(),advance:vi.fn(),answer:vi.fn(),draft:vi.fn(),dependencies:vi.fn()}));
vi.mock('../../server/agent/store.js',()=>({createReadingStore:()=>({getRun:mock.getRun})}));
vi.mock('../../server/agent/investigation-store.js',()=>({createInvestigationStore:()=>({snapshot:mock.snapshot})}));
vi.mock('../../server/agent/runtime.js',()=>({createInvestigationDependencies:mock.dependencies}));
vi.mock('../../server/reader/read-document.js',()=>({createDocumentReader:()=>vi.fn()}));
vi.mock('../../server/agent/reading.js',()=>({advanceReading:mock.reading}));
vi.mock('../../server/agent/loop.js',()=>({advanceInvestigation:mock.advance}));
vi.mock('../../server/agent/answer-question.js',()=>({answerQuestion:mock.answer}));
vi.mock('../../server/draft/write-draft.js',()=>({writeDraft:mock.draft}));
vi.mock('../../server/draft/store.js',()=>({createDraftStore:()=>({})}));
vi.mock('../../server/draft/model.js',()=>({createDraftGenerator:()=>vi.fn()}));
import {runLiveCase,newCheckpoint,cleanupLiveCase} from '../../eval/live-run.js';
const spec:EvalCase={id:'test',title:'Synthetic',today:'2026-10-02',documents:[],answers:{refund_amount:'INR 9,999'},expected:{facts:{},outcome:'ladder',step:1,pauses:[{kind:'conflict',field:'refund_amount'}],draftKind:'grievance_officer'}};
const question={id:'question',kind:'conflict',field:'refund_amount',options:[{id:'one',value:'Rs. 9999'},{id:'two',value:'INR 8999'}]} as QuestionRow;
function client(plan:Partial<PlanRow>|null=null) {
  const query={select:vi.fn(),eq:vi.fn(),is:vi.fn(),order:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn(async()=>({data:plan,error:null}))};
  for(const name of ['select','eq','is','order','limit'] as const)query[name].mockReturnValue(query);
  return {from:vi.fn(()=>query),rpc:vi.fn(async()=>({data:{id:'approved'},error:null})),storage:{from:vi.fn()}} as unknown as SupabaseClient;
}
describe('live runner control flow with fake operations',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();mock.run={id:'run',phase:'investigating',status:'running',turn:0,agent_state:{quotes_checked:true}} as AgentRunRow;
    mock.getRun.mockImplementation(async()=>mock.run);mock.snapshot.mockResolvedValue({facts:[],questions:[]});mock.dependencies.mockReturnValue({});mock.draft.mockResolvedValue({});
  });
  const state=()=>({...newCheckpoint('batch',spec,1),uploaded:true,runId:'run'});
  it('feeds only the fixed date to production dependencies; expected facts never enter model context',async()=>{
    mock.run.status='out_of_scope';const checkpoint=state();await runLiveCase(client(),'owner',spec,checkpoint,async()=>{});
    expect(checkpoint.finished).toBe(true);expect(mock.advance).not.toHaveBeenCalled();
    const date=mock.dependencies.mock.calls[0]?.[1] as ()=>string;expect(date()).toBe('2026-10-02');
    expect(mock.dependencies.mock.calls[0]).toHaveLength(2);
  });
  it('answers a matching canonical option only after a pause, and retains initial facts before answering',async()=>{
    mock.run.status='waiting_for_user';mock.snapshot.mockResolvedValue({facts:[{field:'refund_amount',status:'conflict',value_norm:null}],questions:[question]});
    mock.answer.mockResolvedValue({run:{...mock.run,status:'out_of_scope'}});
    const checkpoint=state();await runLiveCase(client(),'owner',spec,checkpoint,async()=>{});
    expect(mock.answer.mock.calls[0]?.[2]).toEqual({questionId:'question',answer:{optionId:'one'}});
    expect(checkpoint.initialFacts).toEqual([{field:'refund_amount',status:'conflict',value_norm:null}]);
  });
  it('preserves unexpected questions as measured failures rather than supplying a guessed answer',async()=>{
    mock.run.status='waiting_for_user';mock.snapshot.mockResolvedValue({facts:[],questions:[{...question,field:'order_id'}]});
    const checkpoint=state();await runLiveCase(client(),'owner',spec,checkpoint,async()=>{});
    expect(mock.answer).not.toHaveBeenCalled();expect(checkpoint.finished).toBe(true);
  });
  it('resumes drafting an already-approved plan after a previous interruption',async()=>{
    mock.run.status='completed';const c=client({id:'plan',approved_at:'now',ladder_step:2,sent_on:null});
    const checkpoint=state();await runLiveCase(c,'owner',spec,checkpoint,async()=>{});
    expect(mock.draft).toHaveBeenCalledTimes(1);expect(c.rpc).not.toHaveBeenCalled();expect(checkpoint.finished).toBe(true);
  });
  it('stops on returned cooldown immediately without sleeping or advancing again',async()=>{
    mock.advance.mockResolvedValue({run:mock.run,retryAfterMs:10000});const checkpoint=state();
    await expect(runLiveCase(client(),'owner',spec,checkpoint,async()=>{})).rejects.toThrow(/retry after/);
    expect(mock.advance).toHaveBeenCalledTimes(1);expect(checkpoint.finished).toBe(false);
  });
  it('refuses cleanup outside the owned synthetic checkpoint',async()=>{
    const checkpoint=state();checkpoint.finished=true;checkpoint.paths=['other-owner/another-case/file.pdf'];
    const c=client();await expect(cleanupLiveCase(c,'owner',checkpoint)).rejects.toThrow(/outside/);
    expect(c.from).not.toHaveBeenCalled();
  });
});
