import {randomUUID} from 'node:crypto';
import {writeFileSync,renameSync} from 'node:fs';
import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {createUserClient} from '../server/db.js';
import {HttpError} from '../server/http.js';
import {observeModelCalls} from '../server/llm/observer.js';
import {EvaluationBudget, type CallCounts} from './budget.js';
import {loadCorpus} from './corpus.js';
import {reportMarkdown} from './metrics.js';
import {cleanupLiveCase,newCheckpoint,observeLiveCase,runLiveCase,type EvalCheckpoint} from './live-run.js';
import type {EvaluationObservation} from './types.js';

const countsSchema=z.object({logicalCalls:z.number().int().nonnegative(),providerAttempts:z.number().int().nonnegative(),models:z.record(z.string(),z.number().int().nonnegative()),
  answers:z.array(z.object({modelId:z.string(),firstModelId:z.string(),attempts:z.array(z.string())})).optional()});
const checkpointSchema=z.object({caseId:z.uuid(),title:z.string().startsWith('Evaluation '),runId:z.uuid().nullable(),uploaded:z.boolean(),paths:z.array(z.string()),
  initialFacts:z.array(z.object({field:z.string(),status:z.enum(['document','user','conflict','missing','needs_check']),value_norm:z.record(z.string(),z.unknown()).nullable()})),
  startedAt:z.string(),seconds:z.number().nonnegative(),calls:countsSchema,finished:z.boolean(),cleaned:z.boolean(),failureCode:z.string().nullable().default(null)});
const batchSchema=z.object({batch:z.uuid(),owner:z.uuid(),datasetHash:z.string(),logicalLimit:z.number().int().positive(),attemptLimit:z.number().int().positive(),
  entries:z.record(z.string(),checkpointSchema)});
type Batch=z.infer<typeof batchSchema>;
async function atomicJson(path:string,value:unknown):Promise<void> {
  await mkdir(resolve(path,'..'),{recursive:true});
  await writeFile(path+'.new',JSON.stringify(value,null,2)+'\n');await rename(path+'.new',path);
}
function positive(raw:string|undefined,name:string):number {
  const number=Number(raw);if(!Number.isSafeInteger(number)||number<1)throw new Error(`${name} must be a positive integer.`);return number;
}
function args(argv:string[]) {
  const options=new Map<string,string>();
  const flags=new Set<string>();
  for(let i=0;i<argv.length;i++) {
    const arg=argv[i]!;
    if(['--live','--dry-run','--report','--cleanup-completed','--continue-on-stop'].includes(arg)) flags.add(arg);
    else if(['--session-file','--max-logical-calls','--max-provider-attempts','--case','--rounds','--repetitions'].includes(arg)) {
      const value=argv[++i];if(!value||value.startsWith('--'))throw new Error(`Missing value for ${arg}`);options.set(arg,value);
    } else throw new Error(`Unknown option ${arg}`);
  }
  if(['--live','--dry-run','--report'].filter(mode=>flags.has(mode)).length>1)
    throw new Error('Choose exactly one mode: live, dry-run or report.');
  if(options.has('--rounds')&&options.has('--repetitions'))throw new Error('Choose rounds or explicit repetitions, not both.');
  return {options,flags};
}
async function observations():Promise<EvaluationObservation[]> {
  await mkdir('eval/results',{recursive:true});
  const files=(await readdir('eval/results')).filter(f=>/^[a-z0-9-]+-[123]\.json$/.test(f));
  return Promise.all(files.map(async f=>JSON.parse(await readFile(resolve('eval/results',f),'utf8')) as EvaluationObservation));
}
function addCounts(a:CallCounts,b:CallCounts):CallCounts {
  const models={...a.models};for(const [id,n]of Object.entries(b.models))models[id]=(models[id]??0)+n;
  const answers=[...(a.answers??[]),...(b.answers??[])];
  return {logicalCalls:a.logicalCalls+b.logicalCalls,providerAttempts:a.providerAttempts+b.providerAttempts,models,...(answers.length?{answers}:{})};
}
function difference(after:CallCounts,before:CallCounts):CallCounts {
  return {logicalCalls:after.logicalCalls-before.logicalCalls,providerAttempts:after.providerAttempts-before.providerAttempts,
    models:Object.fromEntries(Object.entries(after.models).map(([id,n])=>[id,n-(before.models[id]??0)]).filter(([,n])=>Number(n)>0)),
    ...(after.answers?.length?{answers:after.answers.slice(before.answers?.length??0)}:{})};
}
export async function main(argv=process.argv.slice(2)):Promise<void> {
  const {options,flags}=args(argv),corpus=await loadCorpus();
  const writeReport=async()=>writeFile('eval/report.md',reportMarkdown(corpus.cases,await observations(),corpus.hash));
  if(!flags.has('--live')) {
    await writeReport();
    console.log(`Corpus validated: ${corpus.cases.length} cases, ${corpus.cases.reduce((n,c)=>n+c.documents.length,0)} documents. No model or database calls.`);
    console.log('Wrote eval/report.md. Use --live only after approval of the stated call budget.');return;
  }
  const logicalLimit=positive(options.get('--max-logical-calls'),'--max-logical-calls');
  const attemptLimit=positive(options.get('--max-provider-attempts'),'--max-provider-attempts');
  const rounds=positive(options.get('--rounds')??'3','--rounds');if(rounds>3)throw new Error('At most three repetitions per case.');
  const repetitions=options.has('--repetitions')?options.get('--repetitions')!.split(',').map(n=>positive(n,'--repetitions')):Array.from({length:rounds},(_,i)=>i+1);
  if(repetitions.some(n=>n>3)||new Set(repetitions).size!==repetitions.length)throw new Error('Repetitions must be distinct values from 1 to 3.');
  const sessionPath=options.get('--session-file');if(!sessionPath)throw new Error('Supply an ignored session file; never put an access token on the command line.');
  try{process.loadEnvFile('.env.local');}catch(error){if(!error||typeof error!=='object'||!('code'in error)||error.code!=='ENOENT')throw error;}
  const session=z.object({token:z.string().min(1)}).parse(JSON.parse(await readFile(sessionPath,'utf8')));
  const client=createUserClient(session.token);const auth=await client.auth.getUser(session.token);
  if(auth.error||!auth.data.user)throw new Error('The evaluation session expired. Refresh the existing local session and resume.');
  const owner=auth.data.user.id;const checkpointPath='tmp/eval/checkpoint.json';
  let batch:Batch;
  try {batch=batchSchema.parse(JSON.parse(await readFile(checkpointPath,'utf8')));}
  catch(error){if(!error||typeof error!=='object'||!('code'in error)||error.code!=='ENOENT')throw error;
    batch={batch:randomUUID(),owner,datasetHash:corpus.hash,logicalLimit,attemptLimit,entries:{}};}
  if(batch.owner!==owner||batch.datasetHash!==corpus.hash)throw new Error('Checkpoint owner or corpus changed. Preserve the previous checkpoint before starting a separate batch.');
  if(batch.logicalLimit!==logicalLimit||batch.attemptLimit!==attemptLimit)throw new Error('Resume with the originally approved budgets. Increasing them requires another approval and a new batch.');
  const used=Object.values(batch.entries).reduce((total,e)=>addCounts(total,e.calls),{logicalCalls:0,providerAttempts:0,models:{}} as CallCounts);
  if(used.logicalCalls>logicalLimit||used.providerAttempts>attemptLimit)throw new Error('Checkpoint counts exceed the approved budget. Inspect the prior batch before continuing.');
  let persistActiveCounts: (()=>void)|undefined;
  const budget=new EvaluationBudget(logicalLimit-used.logicalCalls,attemptLimit-used.providerAttempts,()=>persistActiveCounts?.());
  const persist=()=>atomicJson(checkpointPath,batch);
  const subset=options.get('--case')?.split(',');
  if(subset?.some(id=>!corpus.cases.some(c=>c.id===id)))throw new Error('Unknown evaluation case ID.');
  await persist();
  for(const spec of corpus.cases.filter(c=>!subset||subset.includes(c.id))) {
    for(const repetition of repetitions) {
      const key=`${spec.id}-${repetition}`,state=batch.entries[key]??newCheckpoint(batch.batch,spec,repetition);
      batch.entries[key]=state;
      if(state.finished) {
        // A network stop may have happened after finishing, but before saving the audit.
        // Recover that audit before cleanup; this branch never invokes a model.
        if(!state.cleaned) {
          await atomicJson(resolve('eval/results',key+'.json'),await observeLiveCase(client,spec,state,repetition,corpus.hash,state.failureCode));
          await writeReport();
          if(flags.has('--cleanup-completed')) {await cleanupLiveCase(client,owner,state);await persist();}
        } else {
          const saved=JSON.parse(await readFile(resolve('eval/results',key+'.json'),'utf8')) as EvaluationObservation;
          if(saved.datasetHash!==corpus.hash||saved.caseId!==spec.id||saved.repetition!==repetition) throw new Error('A cleaned evaluation case has no matching saved audit.');
        }
        continue;
      }
      if(budget.snapshot().logicalCalls>=budget.logicalLimit||budget.snapshot().providerAttempts>=budget.attemptLimit) {
        console.log('The batch call budget is exhausted. Saved audits remain available; seek approval before another batch.');
        await writeReport();process.exitCode=2;return;
      }
      console.log(`Running ${key}; fixed India date ${spec.today}.`);
      const start=performance.now(),before=budget.snapshot(),previousCalls={...state.calls,models:{...state.calls.models}},previousSeconds=state.seconds;
      const checkpoint=async()=>{
        state.calls=addCounts(previousCalls,difference(budget.snapshot(),before));
        state.seconds=previousSeconds+(performance.now()-start)/1000;
        await persist();
      };
      // Persist each attempt BEFORE invoking its SDK. A crash cannot silently replenish its budget.
      persistActiveCounts=()=>{
        state.calls=addCounts(previousCalls,difference(budget.snapshot(),before));
        state.seconds=previousSeconds+(performance.now()-start)/1000;
        writeFileSync(checkpointPath+'.count-new',JSON.stringify(batch,null,2)+'\n');
        renameSync(checkpointPath+'.count-new',checkpointPath);
      };
      let stopReason:string|null=null;let interrupted=false;
      try {await observeModelCalls(budget,()=>runLiveCase(client,owner,spec,state,checkpoint));}
      catch(error) {
        // Invalid draft output is a completed measured failure; quota/network stops are resumable.
        if(error instanceof HttpError && error.code==='draft_template_invalid') {state.finished=true;stopReason=error.code;state.failureCode=error.code;}
        else {interrupted=true;stopReason=error instanceof HttpError?error.code:'evaluation_operation_failed';}
      }
      await checkpoint();
      persistActiveCounts=undefined;
      try {
        const observation=await observeLiveCase(client,spec,state,repetition,corpus.hash,stopReason);
        await atomicJson(resolve('eval/results',key+'.json'),observation);await writeReport();
      } catch {
        console.log('Could not fetch the run audit. The ignored checkpoint and hosted case retain progress.');interrupted=true;
      }
      console.log(`${key}: ${state.finished?'finished':'interrupted'}; charged ${state.calls.logicalCalls}, attempted ${state.calls.providerAttempts}, ${state.seconds.toFixed(2)} active seconds${stopReason?`; ${stopReason}`:''}.`);
      if(interrupted) {
        process.exitCode=2;
        if(!flags.has('--continue-on-stop')||stopReason==='evaluation_budget')return;
        // One pass only: retain this interruption, then try the next case without retry or sleep.
        continue;
      }
      if(flags.has('--cleanup-completed')) {await cleanupLiveCase(client,owner,state);await persist();}
    }
  }
  await writeReport();console.log('Requested evaluation runs finished. Read all failures in eval/report.md.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error=>{console.error(error instanceof HttpError?`${error.code}: ${error.message}`:error instanceof Error?error.message:'Evaluation failed.');process.exitCode=1;});
