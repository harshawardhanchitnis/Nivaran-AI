import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {AgentRunRow, AgentEventRow, DraftRow, PlanRow} from '../shared/database.js';
import {EVIDENCE_BUCKET,evidencePath} from '../shared/limits.js';
import {normaliseFact} from '../shared/normalise.js';
import {isFactField} from '../shared/facts.js';
import {createReadingStore} from '../server/agent/store.js';
import {startReading} from '../server/agent/start.js';
import {advanceReading} from '../server/agent/reading.js';
import {createDocumentReader} from '../server/reader/read-document.js';
import {advanceInvestigation} from '../server/agent/loop.js';
import {createInvestigationStore} from '../server/agent/investigation-store.js';
import {createInvestigationDependencies} from '../server/agent/runtime.js';
import {answerQuestion} from '../server/agent/answer-question.js';
import {createDraftStore} from '../server/draft/store.js';
import {writeDraft} from '../server/draft/write-draft.js';
import {createDraftGenerator} from '../server/draft/model.js';
import {HttpError} from '../server/http.js';
import {stable} from './metrics.js';
import type {CallCounts} from './budget.js';
import type {EvalCase,EvaluationObservation,ObservedFact} from './types.js';

export interface EvalCheckpoint {
  caseId:string; title:string; runId:string|null; uploaded:boolean; paths:string[];
  initialFacts:ObservedFact[]; startedAt:string; seconds:number; calls:CallCounts;
  finished:boolean; cleaned:boolean; failureCode:string|null;
}
export function newCheckpoint(batch:string,spec:EvalCase,repetition:number):EvalCheckpoint {
  return {caseId:randomUUID(),title:`Evaluation ${batch}: ${spec.id} / ${repetition}`,runId:null,uploaded:false,paths:[],
    initialFacts:[],startedAt:new Date().toISOString(),seconds:0,calls:{logicalCalls:0,providerAttempts:0,models:{}},finished:false,cleaned:false,failureCode:null};
}
const demand=(error:unknown,message:string)=>{if(error) throw new HttpError(503,'evaluation_storage',message);};

/** Only synthetic files named by this corpus are uploaded; the caller remains subject to RLS. */
async function prepare(client:SupabaseClient,userId:string,spec:EvalCase,state:EvalCheckpoint,checkpoint:()=>Promise<void>) {
  const existing=await client.from('cases').select('title').eq('id',state.caseId).maybeSingle();
  demand(existing.error,'Could not inspect the evaluation case.');
  if(existing.data && existing.data.title!==state.title) throw new Error('Checkpoint case title does not match.');
  if(!existing.data) {
    const inserted=await client.from('cases').insert({id:state.caseId,title:state.title,merchant_name:spec.id==='out-of-scope'?null:'Meridian Mart'});
    demand(inserted.error,'Could not create the synthetic evaluation case.');
  }
  for(const [index,doc] of spec.documents.entries()) {
    const label=`E${String(index+1).padStart(2,'0')}`;
    const saved=await client.from('documents').select('id,storage_path').eq('case_id',state.caseId).eq('label',label).maybeSingle();
    demand(saved.error,'Could not inspect a synthetic document.');
    if(saved.data) {if(!state.paths.includes(saved.data.storage_path))state.paths.push(saved.data.storage_path);continue;}
    const id=randomUUID(),path=evidencePath(userId,state.caseId,id,doc.file);
    // Persist the exact path before upload so an interrupted upload remains attributable.
    state.paths.push(path);await checkpoint();
    const bytes=await readFile(resolve('eval/cases',spec.id,doc.file));
    const mime=doc.format==='pdf'?'application/pdf':'image/png';
    const upload=await client.storage.from(EVIDENCE_BUCKET).upload(path,bytes,{contentType:mime,upsert:false});
    demand(upload.error,'Could not upload the synthetic document.');
    const row=await client.from('documents').insert({id,case_id:state.caseId,label,file_name:doc.file,storage_path:path,mime_type:mime,size_bytes:bytes.length});
    demand(row.error,'Could not save the synthetic document row.');
  }
  state.uploaded=true;await checkpoint();
}

/** Uses the same production operations as advance, with an explicit fixed evaluation date. */
export async function runLiveCase(client:SupabaseClient,userId:string,spec:EvalCase,state:EvalCheckpoint,checkpoint:()=>Promise<void>):Promise<void> {
  if(!state.uploaded) await prepare(client,userId,spec,state,checkpoint);
  const reading=createReadingStore(client), investigation=createInvestigationStore(client);
  const dependencies=createInvestigationDependencies(client,()=>spec.today);
  const reader=createDocumentReader(client);
  let run:AgentRunRow=state.runId?await reading.getRun(state.runId):await startReading(reading,state.caseId);
  state.runId=run.id;await checkpoint();
  // Ten model-chosen steps remain enforced by the production loop; this also bounds zero-call turns.
  for(let advances=0;advances<80;advances++) {
    if(run.agent_state.quotes_checked && !state.initialFacts.length) {
      state.initialFacts=(await investigation.snapshot(run)).facts.map(({field,status,value_norm})=>({field,status,value_norm}));
      await checkpoint();
    }
    if(run.status==='waiting_for_user') {
      const question=(await investigation.snapshot(run)).questions.at(-1);
      const field=question?.field && isFactField(question.field)?question.field:null;
      const answer=field?spec.answers[field]:undefined;
      // Unexpected questions and unreadable files stay paused. Never feed the expected result to a model.
      if(!question||!field||!answer) {state.finished=true;await checkpoint();return;}
      let input:string|{optionId:string}=answer;
      if(question.options.length) {
        const target=normaliseFact(field,answer);
        const option=question.options.find(o=>{
          if(!o||typeof o!=='object'||!('id'in o))return false;
          const value='value'in o?o.value:'label'in o?o.label:null;
          return typeof value==='string'&&stable(normaliseFact(field,value))===stable(target);
        });
        if(!option||typeof option!=='object'||!('id'in option)||typeof option.id!=='string') {state.finished=true;await checkpoint();return;}
        input={optionId:option.id};
      }
      run=(await answerQuestion(investigation,dependencies,{questionId:question.id,answer:input})).run;
      await checkpoint();continue;
    }
    if(run.status!=='running') break;
    const response=run.phase==='reading'?await advanceReading(reading,reader,run.id,run.turn):await advanceInvestigation(investigation,dependencies,run.id,run.turn);
    run=response.run;await checkpoint();
    if(response.retryAfterMs) throw new HttpError(429,'model_cooldown',`Models are unavailable; retry after at least ${Math.ceil(response.retryAfterMs/1000)} seconds. The same turn is saved.`);
  }
  if(run.status==='running') throw new HttpError(409,'evaluation_turn_limit','The runner stopped after eighty advances. Progress is saved.');
  // An interrupted draft may leave an approved plan on a completed run. Resume that draft too.
  if(run.status==='plan_ready' || run.status==='completed') {
    const plan=await client.from('plans').select('*').eq('run_id',run.id).is('rejected_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle<PlanRow>();
    demand(plan.error,'Could not read the proposed plan.');
    if(plan.data && [1,2].includes(plan.data.ladder_step) && !(plan.data.ladder_step===1&&plan.data.sent_on)) {
      // Predeclared simulated consumer approval is confined to these fictional evaluation cases.
      if(!plan.data.approved_at) {
        const approved=await client.rpc('review_plan',{p_plan_id:plan.data.id,p_action:'approve'});
        demand(approved.error,'Could not approve the synthetic plan.');
        if(!approved.data) throw new HttpError(409,'evaluation_plan_changed','The synthetic plan changed before approval.');
      }
      await writeDraft(createDraftStore(client),{today:()=>spec.today,generate:createDraftGenerator(client)},plan.data.id);
    }
  }
  state.finished=true;await checkpoint();
}

export async function observeLiveCase(client:SupabaseClient,spec:EvalCase,state:EvalCheckpoint,repetition:number,datasetHash:string,stopReason:string|null):Promise<EvaluationObservation> {
  const empty:EvaluationObservation={caseId:spec.id,repetition,mode:'live',datasetHash,startedAt:state.startedAt,status:state.finished?'finished':'interrupted',stopReason,seconds:state.seconds,calls:state.calls,runStatus:null,runError:null,initialFacts:state.initialFacts,finalFacts:[],quotes:{passed:0,total:0},pauses:[],outcome:null,step:null,draftKind:null,injectionMarkerSeen:false,saved:null};
  if(!state.runId)return empty;
  const store=createInvestigationStore(client);const run=await store.getRun(state.runId);const snapshot=await store.snapshot(run);
  const [events,plans,drafts]=await Promise.all([
    client.from('agent_events').select('*').eq('run_id',run.id).order('seq').returns<AgentEventRow[]>(),
    client.from('plans').select('*').eq('run_id',run.id).order('created_at',{ascending:false}).returns<PlanRow[]>(),
    client.from('drafts').select('*').eq('case_id',state.caseId).order('version',{ascending:false}).returns<DraftRow[]>(),
  ]);
  if([events,plans,drafts].some(r=>r.error))throw new HttpError(503,'evaluation_snapshot','Could not save the run audit. Hosted progress remains available.');
  const plan=plans.data?.find(p=>!p.rejected_at)??null,draft=drafts.data?.find(d=>d.plan_id===plan?.id)??null;
  const evidence=snapshot.evidence.filter(e=>e.source==='document');
  const outcome=run.status==='out_of_scope'?'out_of_scope':run.status==='waiting_for_user'?'needs_input':typeof run.agent_state.next_step?.['outcome']==='string'?run.agent_state.next_step['outcome']:null;
  const redactOwner=<T extends {user_id:string}>(rows:T[])=>rows.map(row=>({...row,user_id:'synthetic-evaluation-owner'}));
  const saved={run:{...run,user_id:'synthetic-evaluation-owner',processing_token:null,processing_started_at:null},documents:redactOwner(snapshot.documents).map(d=>({...d,storage_path:`eval/cases/${spec.id}/${d.file_name}`})),
    facts:redactOwner(snapshot.facts),evidence:redactOwner(snapshot.evidence),questions:redactOwner(snapshot.questions),events:redactOwner(events.data??[]),
    plan:plan?{...plan,user_id:'synthetic-evaluation-owner'}:null,draft:draft?{...draft,user_id:'synthetic-evaluation-owner'}:null};
  // The source quote may legitimately contain the attack marker; inspect interpreted values/prose, not raw evidence.
  const interpreted=JSON.stringify({facts:snapshot.facts.map(f=>f.value_text),summary:plan?.summary,template:draft?.template_md,questions:snapshot.questions.map(q=>q.prompt)});
  return {...empty,runStatus:run.status,runError:run.error,finalFacts:snapshot.facts.map(({field,status,value_norm})=>({field,status,value_norm})),
    quotes:{passed:evidence.filter(e=>e.quote_verified===true).length,total:evidence.length},
    pauses:snapshot.questions.map(q=>({kind:q.kind,field:q.field})),outcome,step:plan?.ladder_step??(typeof run.agent_state.next_step?.['step']==='number'?run.agent_state.next_step['step']:null),
    draftKind:draft?.kind??null,injectionMarkerSeen:!!spec.injectionMarker&&interpreted.includes(spec.injectionMarker),saved};
}

/** Remove only a completed corpus case whose ID, owner, title and paths match this checkpoint. */
export async function cleanupLiveCase(client:SupabaseClient,userId:string,state:EvalCheckpoint):Promise<void> {
  if(!state.finished||state.cleaned) return;
  if(state.paths.some(path=>!path.startsWith(`${userId}/${state.caseId}/`)))throw new Error('Refusing cleanup outside this evaluation case.');
  const row=await client.from('cases').select('title,user_id').eq('id',state.caseId).maybeSingle();
  demand(row.error,'Could not inspect cleanup ownership.');
  if(row.data && (row.data.title!==state.title||row.data.user_id!==userId))throw new Error('Refusing cleanup of a different case.');
  if(state.paths.length) demand((await client.storage.from(EVIDENCE_BUCKET).remove(state.paths)).error,'Synthetic file cleanup failed; the case is retained.');
  demand((await client.from('cases').delete().eq('id',state.caseId).eq('title',state.title).eq('user_id',userId)).error,'Synthetic row cleanup failed.');
  state.cleaned=true;
}
