import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
import {loadCorpus} from '../../eval/corpus.js';
import {nextStep} from '../../server/ladder/engine.js';
import {pdfTextPages} from '../../server/reader/pdf-text.js';
import {normaliseFact} from '../../shared/normalise.js';
import type {CaseFactRow} from '../../shared/database.js';
import {FACT_FIELDS} from '../../shared/facts.js';
describe('authored synthetic evaluation ground truth',()=>{
  it('has twelve named paths and every text PDF preserves all authored source lines',async()=>{
    const {cases,hash}=await loadCorpus();expect(cases).toHaveLength(12);expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(cases.flatMap(c=>c.documents)).toHaveLength(29);
    for(const spec of cases)for(const doc of spec.documents.filter(d=>d.format==='pdf')) {
      const pages=await pdfTextPages(new Uint8Array(await readFile(resolve('eval/cases',spec.id,doc.file))));
      const text=pages?.join(' ').replace(/\s+/g,' ');
      for(const line of doc.lines.filter(l=>l.trim()))expect(text,`${spec.id}/${doc.file}: ${line}`).toContain(line.replace(/\s+/g,' '));
    }
  });
  it('expected steps follow the code ladder using only authored values and specified user answers',async()=>{
    const {cases}=await loadCorpus();
    for(const spec of cases.filter(c=>c.expected.outcome!=='out_of_scope')) {
      const facts:CaseFactRow[]=FACT_FIELDS.map(field=>{
        const expected=spec.expected.facts[field],answer=spec.answers[field];
        return {id:field,field,case_id:'synthetic',user_id:'synthetic',created_at:'',updated_at:'',value_text:answer??null,evidence_item_id:null,
          confirmed_by_user:!!answer,status:answer?'user':expected?.status==='document'?'document':expected?.status==='conflict'?'conflict':'missing',
          value_norm:answer?normaliseFact(field,answer):expected?.value??null};
      });
      const step=nextStep(facts,spec.today,{refundProcessed:spec.id==='bank-reference'});
      expect(step.outcome,spec.id).toBe(spec.expected.outcome);expect(step.step??null,spec.id).toBe(spec.expected.step);
    }
  });
});
