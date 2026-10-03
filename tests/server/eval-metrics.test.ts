import {describe,expect,it} from 'vitest';
import {factCorrect,reportMarkdown,resultSignature,scoreRun,seededLintMeasure} from '../../eval/metrics.js';
import type {EvalCase,EvaluationObservation} from '../../eval/types.js';
const spec:EvalCase={id:'case',title:'Case',today:'2026-10-02',documents:[],answers:{},expected:{facts:{refund_amount:{status:'document',value:{kind:'amount',decimal:'9999.00',currency:'INR'}}},outcome:'ladder',step:1,pauses:[],draftKind:'grievance_officer'}};
function observed():EvaluationObservation {return {caseId:'case',repetition:1,mode:'live',datasetHash:'hash',startedAt:'now',status:'finished',stopReason:null,seconds:2,calls:{logicalCalls:4,providerAttempts:5,models:{}},runStatus:'completed',runError:null,initialFacts:[{field:'refund_amount',status:'document',value_norm:{kind:'amount',currency:'INR',decimal:'9999.00'}}],finalFacts:[],quotes:{passed:2,total:3},pauses:[],outcome:'ladder',step:1,draftKind:'grievance_officer',injectionMarkerSeen:false,saved:null};}
describe('honest evaluation metrics',()=>{
  it('does not score interrupted or never-started runs as correct absent drafts or pauses',()=>{
    const result=observed();result.status='interrupted';result.runStatus=null;
    const report=reportMarkdown([spec],[result],'hash');
    expect(report).toContain('interrupted/no run | N/A | N/A | N/A');
    expect(report).toContain('0/0 outcome/step');
  });
  it('lists actual responses and fallback separately from attempted models',()=>{
    const result=observed();result.calls.models={failed:1,fallback:1};
    result.calls.answers=[{modelId:'fallback',firstModelId:'failed',attempts:['failed','fallback']}];
    const report=reportMarkdown([spec],[result],'hash');
    expect(report).toContain('| fallback: 1 | 1/1 | failed: 1; fallback: 1 |');
    expect(report).toContain('4 logical charges / 5 provider attempts');
  });
  it('does not count a failed agent with an earlier code decision as a successful ladder result',()=>{
    const result=observed();result.runStatus='failed';result.runError='Step limit reached';
    expect(scoreRun(spec,result).stepCorrect).toBe(false);
    expect(reportMarkdown([spec],[result],'hash')).toContain('finished/failed');
  });
  it('compares canonical values and statuses; missing output is never counted as correct',()=>{
    const result=observed();expect(scoreRun(spec,result).facts['refund_amount']).toBe(true);
    expect(factCorrect(undefined,undefined)).toBe(false);
    result.initialFacts[0]!.status='needs_check';expect(scoreRun(spec,result).facts['refund_amount']).toBe(false);
    expect(factCorrect({status:'absent'},{field:'refund_reference',status:'document',value_norm:{kind:'absent',value:false}})).toBe(true);
  });
  it('counts unexpected or duplicated pauses as wrong, including unnecessary questions',()=>{
    const result=observed();result.pauses=[{kind:'missing',field:'order_id'}];
    expect(scoreRun(spec,result).pausesCorrect).toBe(false);
  });
  it('requires three results for consistency and never fabricates empty accuracy',()=>{
    expect(reportMarkdown([spec],[],'hash')).toContain('No live product-evaluation results');
    const report=reportMarkdown([spec],[observed()],'hash');
    expect(report).toContain('0/0 completed triples');expect(report).toContain('2/3 extracted document quotes');
    expect(report).toContain('4 / 5');
  });
  it('includes failures, excludes stale data, and ignores IDs and timing in consistency',()=>{
    const a=observed(),b={...observed(),repetition:2,seconds:300};
    expect(resultSignature(a)).toBe(resultSignature(b));
    b.outcome='bank_delay';expect(resultSignature(a)).not.toBe(resultSignature(b));
    expect(reportMarkdown([spec],[{...a,datasetHash:'old'}],'hash')).toContain('0/36');
    expect(seededLintMeasure().every(p=>p.caught)).toBe(true);
  });
});
