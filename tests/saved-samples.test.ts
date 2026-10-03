import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SAMPLE_CASES, sampleDocumentPath } from '../shared/samples.js';
import type { SavedSample } from '../shared/samples.js';
import type { EvaluationObservation } from '../eval/types.js';

describe('public saved samples are actual synthetic audits', () => {
  it.each(SAMPLE_CASES)('$id preserves recorded facts/events/questions and discloses provenance', card => {
    const saved = JSON.parse(readFileSync(`public/samples/${card.id}/run.json`, 'utf8')) as SavedSample;
    const batch = card.id === 'not-yet-due' ? 'rerun-stage-one' : 'final-stage-one';
    const audit = JSON.parse(readFileSync(`eval/results/${batch}/${card.id}-1.json`, 'utf8')) as EvaluationObservation;
    expect(saved.facts).toEqual(audit.saved?.facts);
    expect(saved.events).toEqual(audit.saved?.events);
    expect(saved.questions).toEqual(audit.saved?.questions);
    expect(saved.draft).toEqual(audit.saved?.draft);
    expect(saved.provenance).toContain(batch);
    expect(saved.logicalCalls).toBe(audit.calls.logicalCalls);
    expect(saved.run.processing_token).toBeNull();
    for (const document of saved.documents) {
      expect(readFileSync('.' + sampleDocumentPath(saved, document).replace('/samples/', '/public/samples/'))).toEqual(readFileSync(`eval/cases/${card.id}/${document.file_name}`));
      expect(document.user_id).toBe('synthetic-evaluation-owner');
    }
    if (['not-yet-due','already-complained','out-of-scope'].includes(card.id)) expect(saved.warning).toBeTruthy();
    expect(saved.guidance.every(row => row.checked_on === '2026-10-02')).toBe(true);
  });
  it('rejects foreign files and path traversal', () => {
    const saved = JSON.parse(readFileSync('public/samples/clean-overdue/run.json', 'utf8')) as SavedSample;
    expect(() => sampleDocumentPath(saved, {...saved.documents[0]!,file_name:'../../.env.local'})).toThrow();
    expect(() => sampleDocumentPath({...saved,id:'../private'}, saved.documents[0]!)).toThrow();
  });
});
