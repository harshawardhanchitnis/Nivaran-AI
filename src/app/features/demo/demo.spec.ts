import { TestBed } from '@angular/core/testing';
import { Demo } from './demo';

describe('quota-free invented practice with the real editor', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Demo);
    await fixture.whenStable();
    return { fixture, page:fixture.nativeElement as HTMLElement };
  }
  it('leaves an unsure conflict open rather than inventing a resolution', async () => {
    const {fixture,page} = await setup();
    Array.from(page.querySelectorAll<HTMLButtonElement>('app-question-card button')).find(b => b.textContent?.includes('not sure'))!.click();
    await fixture.whenStable();
    expect(page.textContent).toContain('conflict stays open');
    expect(page.querySelector('app-plan-panel')).toBeNull();
    expect(page.querySelector('app-draft-editor')).toBeNull();
  });
  it('requires answer, approval and explicit preparation, then executes the real edit linter', async () => {
    const {fixture,page} = await setup();
    page.querySelector<HTMLButtonElement>('app-question-card button')!.click();
    await fixture.whenStable();
    expect(page.querySelector('app-draft-editor')).toBeNull();
    Array.from(page.querySelectorAll<HTMLButtonElement>('app-plan-panel button')).find(b => b.textContent?.includes('Approve this plan'))!.click();
    await fixture.whenStable();
    expect(page.querySelector('app-draft-editor')).toBeNull();
    Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.includes('Prepare practice'))!.click();
    await fixture.whenStable();
    expect(page.textContent).toContain('No AI wording was generated');
    const editor = page.querySelector<HTMLTextAreaElement>('#complaint-text')!;
    expect(editor.value).toContain('₹9,999 [your statement]');
    editor.value += '\nFAKE123456'; editor.dispatchEvent(new Event('input',{bubbles:true}));
    await fixture.whenStable();
    expect(page.querySelector('app-complaint-draft article .flag')?.textContent).toBe('FAKE123456');
    Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.trim() === 'Remove')!.click();
    await fixture.whenStable();
    expect(page.querySelector('app-complaint-draft article .flag')).toBeNull();
    Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.includes('Save edits'))!.click();
    await fixture.whenStable();
    expect(page.textContent).toContain('Showing saved version 2');
    expect(page.textContent).toContain('this page only');
  });
});
