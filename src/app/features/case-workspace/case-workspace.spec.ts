import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { CaseWorkspaceService, type WorkspaceRows } from '../../core/case-workspace.service';
import { CaseWorkspace } from './case-workspace';

const saved = {
  case: { id: 'case', title: 'Saved refund case', merchant_name: 'Fictional seller' },
  documents: [{ id: 'image', label: 'E02', file_name: 'support.png', mime_type: 'image/png', doc_type: 'support_chat' }],
  evidence: [{ id: 'reading', field: 'refund_amount', source: 'document', document_id: 'image', value_text: 'INR 9999', quote: 'Refund INR 9999', page: 1 }],
  facts: [], events: [], questions: [], run: { id: 'run', status: 'plan_ready', phase: 'done', turn: 7 },
} as unknown as WorkspaceRows;

describe('real case screen', () => {
  const load = vi.fn(); const sourceUrl = vi.fn(); const start = vi.fn(); const advance = vi.fn(); const answer = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks(); load.mockResolvedValue(saved); sourceUrl.mockResolvedValue('https://example.test/support.png');
    TestBed.configureTestingModule({ imports: [CaseWorkspace], providers: [provideRouter([]),
      { provide: CaseWorkspaceService, useValue: { load, sourceUrl, start, advance, answer } }],
    });
  });
  async function setup() {
    const fixture = TestBed.createComponent(CaseWorkspace); fixture.componentRef.setInput('caseId', 'case');
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }
  it('restores the saved facts and opens their document and quote without a model request', async () => {
    const { fixture, page } = await setup();
    expect(page.textContent).toContain('Saved refund case');
    expect(page.textContent).toContain('Needs your check');
    page.querySelector<HTMLButtonElement>('[data-fact-field="refund_amount"]')!.click();
    await fixture.whenStable();
    expect(sourceUrl).toHaveBeenCalledWith(saved.documents[0]);
    expect(page.querySelector('blockquote')?.textContent).toContain('Refund INR 9999');
    expect(page.querySelector('app-source-panel img')?.getAttribute('src')).toBe('https://example.test/support.png');
    expect(start).not.toHaveBeenCalled(); expect(advance).not.toHaveBeenCalled();
  });
  it('offers a retry for a failed source without restarting reading', async () => {
    sourceUrl.mockRejectedValueOnce(new Error('Could not open this document.'));
    const { fixture, page } = await setup();
    page.querySelector<HTMLButtonElement>('[data-fact-field="refund_amount"]')!.click(); await fixture.whenStable();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Could not open');
    const retry = Array.from(page.querySelectorAll('button')).find(b => b.textContent?.includes('Retry opening'))!;
    retry.click(); await fixture.whenStable();
    expect(sourceUrl).toHaveBeenCalledTimes(2); expect(advance).not.toHaveBeenCalled();
  });
  it('uses roving keyboard tabs and labels the visible panel', async () => {
    const { fixture, page } = await setup();
    const tab = page.querySelector<HTMLButtonElement>('#case-tab-facts')!;
    tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(page.querySelector('#case-tab-activity')?.getAttribute('aria-selected')).toBe('true');
    expect(page.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe('case-tab-activity');
    expect(page.querySelectorAll('[role="tab"][tabindex="0"]')).toHaveLength(1);
  });
  it('shows a plain unavailable-case message and My cases link', async () => {
    load.mockRejectedValue(new Error('This case is not available in this browser.'));
    const { page } = await setup();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('not available');
    expect(page.querySelector('a')?.getAttribute('href')).toBe('/cases');
  });
  it('shows one stored conflict question and resumes after its answer without a reload', async () => {
    const waiting = { ...saved, run: { ...saved.run!, status: 'waiting_for_user' },
      questions: [{ id: 'q', run_id: 'run', kind: 'conflict', field: 'refund_amount', prompt: 'Which refund amount?', options: [{ id: 'one', label: 'INR 9999', value: 'INR 9999' }], answer: null, answered_at: null }] } as WorkspaceRows;
    load.mockResolvedValueOnce(waiting).mockResolvedValue({ ...saved, run: { ...saved.run!, status: 'running', phase: 'investigating', turn: 8 } });
    answer.mockResolvedValue({ run: { ...saved.run!, status: 'running' }, events: [] });
    advance.mockResolvedValue({ run: { ...saved.run!, status: 'plan_ready', phase: 'done' }, events: [] });
    const { fixture, page } = await setup();
    expect(page.querySelectorAll('app-question-card')).toHaveLength(1);
    expect(page.textContent).toContain('Answer the question below to continue. Your progress is saved.');
    page.querySelector<HTMLButtonElement>('app-question-card button')!.click(); await fixture.whenStable();
    expect(answer).toHaveBeenCalledExactlyOnceWith('q', { optionId: 'one' }); expect(advance).toHaveBeenCalledTimes(1);
    expect(page.querySelector('app-question-card')).toBeNull();
  });
});
