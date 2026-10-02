import { TestBed } from '@angular/core/testing';
import type { DraftRow } from '@shared/database';
import type { DraftRenderContext } from '@shared/draft-render';
import { DraftEditor } from './draft-editor';
const draft: DraftRow = {
  id: 'draft',
  case_id: 'case',
  user_id: 'owner',
  plan_id: 'plan',
  kind: 'grievance_officer',
  version: 1,
  template_md: 'Please refund {{fact:refund_amount}}.\n\n{{you:name}}\n{{you:contact}}',
  rendered_md: 'Please refund ₹9,999 [your statement].\n\n{{you:name}}\n{{you:contact}}',
  lint: { userStatements: [], generatedOn: '2026-10-02' },
  edited_by_user: false,
  created_at: '2026-10-02',
};
const context: DraftRenderContext = {
  facts: [
    {
      field: 'refund_amount',
      status: 'user',
      value_text: '9999',
      value_norm: { kind: 'amount', decimal: '9999.00' },
      evidence_item_id: null,
    },
  ],
  documents: [],
  evidence: [],
  dates: {},
  today: '2026-10-02',
};
describe('draft editor using the existing letter component', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [DraftEditor] });
    const fixture = TestBed.createComponent(DraftEditor);
    fixture.componentRef.setInput('draft', draft);
    fixture.componentRef.setInput('context', context);
    await fixture.whenStable();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }
  it('flags a typed made-up ID and offers keep/remove, while keeping private fields out of the save event', async () => {
    const { fixture, page } = await setup();
    const editor = page.querySelector<HTMLTextAreaElement>('#complaint-text')!;
    editor.value = draft.rendered_md + '\nTX99887766';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(page.querySelector('app-complaint-draft article .flag')?.textContent).toBe('TX99887766');
    const name = page.querySelector<HTMLInputElement>('#private-name')!;
    name.value = 'PRIVATE NAME';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(page.querySelector('app-complaint-draft')?.textContent).toContain('PRIVATE NAME');
    let saved: unknown;
    fixture.componentInstance.saveRequested.subscribe((value) => (saved = value));
    Array.from(page.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('Keep as Your statement'))!
      .click();
    await fixture.whenStable();
    expect(page.querySelector('app-complaint-draft article .flag')).toBeNull();
    Array.from(page.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('Save edits'))!
      .click();
    await fixture.whenStable();
    expect(saved).toMatchObject({
      text: expect.stringContaining('{{you:name}}'),
      userStatements: ['TX99887766'],
    });
    expect(JSON.stringify(saved)).not.toContain('PRIVATE NAME');
  });
  it('removes only the flagged token without blocking other edits', async () => {
    const { fixture, page } = await setup();
    const editor = page.querySelector<HTMLTextAreaElement>('#complaint-text')!;
    editor.value = 'Refund ₹8,999. Keep this prose.';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    Array.from(page.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === 'Remove')!
      .click();
    await fixture.whenStable();
    expect(editor.value).toBe('Refund . Keep this prose.');
  });
});
