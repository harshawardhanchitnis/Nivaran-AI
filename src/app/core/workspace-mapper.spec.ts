import type { CaseFactRow, DocumentRow, EvidenceItemRow, QuestionRow } from '@shared/database';
import { workspaceFacts, workspaceActivity, workspaceStage, questionOptions } from './workspace-mapper';

const doc = { id: 'doc', label: 'E01', file_name: 'invoice.pdf', mime_type: 'application/pdf', doc_type: 'invoice' } as DocumentRow;
const item = (id: string, page: number, value = 'Rs. 9999'): EvidenceItemRow => ({
  id, case_id: 'case', user_id: 'owner', source: 'document', document_id: 'doc', field: 'amount_paid',
  value_text: value, value_norm: null, page, quote: `Paid ${value}`, quote_verified: null, created_at: '',
});

describe('workspace facts', () => {
  it('groups readings by field without losing two quotes from the same document', () => {
    const facts = workspaceFacts([doc], [item('one', 1), item('two', 2, 'INR 9,999')], [], {});
    const amount = facts.find(f => f.field === 'amount_paid')!;
    expect(amount.status).toBe('needs_check');
    expect(amount.sources.map(s => [s.id, s.evidence, s.page, s.quote])).toEqual([
      ['one', 'E01', 1, 'Paid Rs. 9999'], ['two', 'E01', 2, 'Paid INR 9,999'],
    ]);
    expect(amount.note).toContain('Quote checks');
    expect(facts.find(f => f.field === 'order_id')?.status).toBe('missing');
  });

  it('uses the stored fact-sheet status and value, keeping user statements source-free', () => {
    const stored = { field: 'amount_paid', value_text: '9999', status: 'document' } as CaseFactRow;
    expect(workspaceFacts([doc], [item('one', 1)], [stored], {})[4]).toMatchObject({ value: '9999', status: 'document' });
    const stated = { ...stored, status: 'user' } as CaseFactRow;
    expect(workspaceFacts([doc], [item('one', 1)], [stated], {})[4]!.sources).toEqual([]);
  });

  it('does not make sources from unknown fields or missing document rows', () => {
    const orphan = { ...item('one', 1), document_id: 'gone' };
    const unknown = { ...item('two', 2), field: 'instructions' };
    expect(workspaceFacts([doc], [orphan, unknown], [], {}).flatMap(f => f.sources)).toEqual([]);
  });

  it('attaches the signed PDF and image previews to their own documents', () => {
    const image = { ...doc, id: 'image', label: 'E02', mime_type: 'image/png' } as DocumentRow;
    const read = { ...item('two', 1), document_id: 'image' };
    const amount = workspaceFacts([doc, image], [item('one', 2), read], [], {
      doc: { url: 'https://project.supabase.co/pdf' }, image: { url: 'https://project.supabase.co/image' },
    })[4]!;
    expect(amount.sources[0]).toMatchObject({ pdfUrl: 'https://project.supabase.co/pdf', page: 2 });
    expect(amount.sources[1]).toMatchObject({ imageUrl: 'https://project.supabase.co/image', page: 1 });
  });
});

describe('workspace progress', () => {
  it('matches conflict choices to exact checked source quotes using normalised amounts', () => {
    const question = { field: 'amount_paid', options: [{id:'a',label:'9999',value:'9999'},{id:'b',label:'8999',value:'8999'}] } as QuestionRow;
    const readings = [{ ...item('one', 1), quote_verified:true }, { ...item('duplicate', 1), quote_verified:true }, { ...item('two',2,'8999'), quote_verified:true }, { ...item('bad',3,'9999'), quote_verified:false }];
    const options = questionOptions(question, [doc], readings);
    expect(options[0]?.sources).toEqual([{ evidence:'E01',documentName:'invoice.pdf',page:1,quote:'Paid Rs. 9999' }]);
    expect(options[1]?.sources?.[0]?.page).toBe(2);
  });
  it('does not invent a source for a typed or non-matching answer', () => {
    expect(questionOptions({field:'amount_paid',options:[{id:'x',label:'100'}]} as QuestionRow,[doc],[{...item('one',1),quote_verified:true}])[0]?.sources).toEqual([]);
  });
  it('uses only safe event messages, ordered by sequence', () => {
    const events = [{ id: 'later', seq: 2, type: 'error', payload: { message: 'Try again.', diagnostic: { message: 'private debug' } }, created_at: '2026-10-02T10:02:00Z' },
      { id: 'first', seq: 1, type: 'tool_result', payload: { tool: 'read_document', message: 'Read E01.' }, created_at: '2026-10-02T10:01:00Z' }];
    const activity = workspaceActivity(events);
    expect(activity.map(a => a.title)).toEqual(['Read E01.', 'Try again.']);
    expect(JSON.stringify(activity)).not.toContain('private debug');
  });
  it('does not suggest investigation has finished after reading', () => {
    expect(workspaceStage({ status: 'running', phase: 'investigating' })).toBe('Checking the next step');
  });
});
