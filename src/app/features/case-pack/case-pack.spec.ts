import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type { WorkspaceRows } from '../../core/case-workspace.service';
import { CaseWorkspaceService } from '../../core/case-workspace.service';
import { CasePack } from './case-pack';
const rows = {
  case: { id: 'case', title: 'Synthetic case' },
  run: { id: 'run', status: 'completed' },
  facts: [
    {
      field: 'refund_due_date',
      status: 'user',
      value_text: '2026-09-24',
      value_norm: { kind: 'date', value: '2026-09-24' },
      evidence_item_id: null,
    },
  ],
  documents: [],
  evidence: [],
  events: [],
  questions: [],
  guidance: [
    {
      id: 'rule',
      title: 'Rule',
      body: 'Checked text',
      source_url: 'https://example.org',
      source_name: 'Source',
      checked_on: '2026-10-02',
      applies_to_steps: [1],
    },
  ],
  plan: {
    id: 'plan',
    ladder_step: 1,
    guidance_ids: ['rule'],
    reasons: [],
    dates: { refund_due: '2026-09-24' },
    approved_at: '2026-10-02',
  },
  draft: {
    id: 'draft',
    plan_id: 'plan',
    version: 1,
    template_md: 'Please refund by {{date:refund_due}}.\n{{you:name}}\n{{you:contact}}',
    rendered_md: 'Please refund by 24 Sept 2026 [your statement].\n{{you:name}}\n{{you:contact}}',
    lint: { generatedOn: '2026-10-02' },
  },
} as unknown as WorkspaceRows;
describe('saved printable pack', () => {
  const load = vi.fn();
  const saveDraftEdit = vi.fn();
  const prepareDraft = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    load.mockResolvedValue(rows);
    saveDraftEdit.mockImplementation(async (input) => ({
      draft: {
        ...rows.draft,
        id: 'edited',
        rendered_md: input.text,
        lint: { userStatements: input.userStatements, generatedOn: '2026-10-02' },
      },
    }));
    TestBed.configureTestingModule({
      imports: [CasePack],
      providers: [
        provideRouter([]),
        { provide: CaseWorkspaceService, useValue: { load, saveDraftEdit, prepareDraft } },
      ],
    });
  });
  async function setup() {
    const fixture = TestBed.createComponent(CasePack);
    fixture.componentRef.setInput('caseId', 'case');
    await fixture.whenStable();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }
  it('loads a saved complaint with its timeline and evidence index without generation', async () => {
    const { page } = await setup();
    expect(page.textContent).toContain('24 Sept 2026');
    expect(page.textContent).toContain('Evidence index');
    expect(page.textContent).toContain('not legal advice');
    expect(prepareDraft).not.toHaveBeenCalled();
  });
  it('lists each document label, filename and quoted pages without generating', async () => {
    load.mockResolvedValue({ ...rows, documents: [{id:'doc',label:'E01',file_name:'synthetic-invoice.pdf',doc_type:'invoice'}], evidence: [{document_id:'doc',page:3},{document_id:'doc',page:2},{document_id:'doc',page:3}] });
    const {page}=await setup();const index=page.querySelector('.evidence-index');
    expect(index?.textContent).toContain('E01');expect(index?.textContent).toContain('synthetic-invoice.pdf');expect(index?.textContent).toContain('Quoted on pages 2, 3');expect(prepareDraft).not.toHaveBeenCalled();
  });
  it('saves placeholders and accepted statements while retaining local private fields', async () => {
    const { page, fixture } = await setup();
    const name = page.querySelector<HTMLInputElement>('#private-name')!;
    name.value = 'PRIVATE NAME';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(saveDraftEdit).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(saveDraftEdit.mock.calls)).not.toContain('PRIVATE NAME');
    expect(JSON.stringify(saveDraftEdit.mock.calls)).toContain('{{you:name}}');
    expect(page.querySelector('app-complaint-draft article')?.textContent).toContain(
      'PRIVATE NAME',
    );
  });
  it('keeps a case without an approved draft usable and never generates on load', async () => {
    load.mockResolvedValue({ ...rows, draft: null });
    const { page } = await setup();
    expect(page.textContent).toContain('after you approve');
    expect(page.querySelector('app-draft-editor')).toBeNull();
    expect(prepareDraft).not.toHaveBeenCalled();
  });
});
