// Export existing synthetic audits only. This command makes no database or model calls.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SAMPLE_CASES } from '../shared/samples.js';
import type { SavedSample } from '../shared/samples.js';
import type { GuidanceRow } from '../shared/database.js';
import type { EvaluationObservation, EvalCase } from './types.js';

const guidance = JSON.parse(await readFile('tmp/t13/guidance.json', 'utf8')) as GuidanceRow[];
for (const card of SAMPLE_CASES) {
  const earlier = card.id === 'not-yet-due';
  const batch = earlier ? 'rerun-stage-one' : 'final-stage-one';
  const audit = JSON.parse(await readFile(`eval/results/${batch}/${card.id}-1.json`, 'utf8')) as EvaluationObservation;
  const spec = JSON.parse(await readFile(`eval/cases/${card.id}/case.json`, 'utf8')) as EvalCase;
  if (!audit.saved || audit.mode !== 'live' || audit.caseId !== card.id || audit.saved.documents.some(d => d.user_id !== 'synthetic-evaluation-owner')) throw new Error('Only audited synthetic runs can become public samples.');
  const saved = audit.saved;
  const warning = earlier ? 'This is the earlier recorded waiting plan, not the final-pass result. The final pass asked an unnecessary reference question.'
    : card.id === 'already-complained' ? 'The plan reached the helpline step, but both model draft attempts failed validation. No complaint was saved.'
    : card.id === 'out-of-scope' ? 'Every text reader returned no usable facts. Document reading failed before the run ended outside scope.' : null;
  const sample: SavedSample = { id: card.id, title: card.title, today: spec.today, recordedAt: audit.startedAt,
    provenance: `${batch}, repetition 1; ${earlier ? 'earlier reader, see docs/t12-fixes.md' : 'revision 3906f5b'}`,
    warning, logicalCalls: audit.calls.logicalCalls, providerAttempts: audit.calls.providerAttempts, models: audit.calls.models,
    ...saved, run: { ...saved.run, processing_token: null, processing_started_at: null },
    guidance: guidance.filter(row => saved.plan?.guidance_ids.includes(row.id)), };
  const directory = resolve('public/samples', card.id); await mkdir(directory, { recursive: true });
  for (const document of sample.documents) {
    if (!spec.documents.some(d => d.file === document.file_name)) throw new Error('Unexpected public document.');
    await copyFile(resolve('eval/cases', card.id, document.file_name), resolve(directory, document.file_name));
  }
  await writeFile(resolve(directory, 'run.json'), JSON.stringify(sample, null, 2) + '\n');
}
console.log('Exported five recorded synthetic samples; no model or database calls.');
