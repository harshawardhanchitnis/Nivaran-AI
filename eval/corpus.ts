import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {evalCaseSchema, type EvalCase} from './types.js';
export async function loadCorpus(root=resolve('eval/cases')):Promise<{cases:EvalCase[];hash:string}> {
  const names:unknown=JSON.parse(await readFile(resolve(root,'index.json'),'utf8'));
  if(!Array.isArray(names)||names.length!==12||new Set(names).size!==12||names.some(n=>typeof n!=='string'||!/^[a-z0-9-]+$/.test(n))) throw new Error('The corpus must contain twelve unique case IDs.');
  const cases:EvalCase[]=[]; const hash=createHash('sha256');
  for(const name of names) {
    const text=await readFile(resolve(root,String(name),'case.json'),'utf8');
    const spec=evalCaseSchema.parse(JSON.parse(text));
    if(spec.id!==name) throw new Error('Case folder and ID disagree.');
    hash.update(text.replace(/\r\n/g,'\n')); cases.push(spec);
    for(const document of spec.documents) hash.update(await readFile(resolve(root,spec.id,document.file)));
  }
  return {cases,hash:hash.digest('hex')};
}
