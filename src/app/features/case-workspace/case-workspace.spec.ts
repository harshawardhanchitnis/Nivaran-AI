import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { CaseWorkspaceService, type WorkspaceRows } from '../../core/case-workspace.service';
import { CasesService } from '../../core/cases.service';
import { CaseWorkspace } from './case-workspace';
import type { GuidanceRow, PlanRow } from '@shared/database';

const saved = {
  case: { id: 'case', title: 'Saved refund case', merchant_name: 'Fictional seller' },
  documents: [
    {
      id: 'image',
      label: 'E02',
      file_name: 'support.png',
      mime_type: 'image/png',
      doc_type: 'support_chat',
    },
  ],
  evidence: [
    {
      id: 'reading',
      field: 'refund_amount',
      source: 'document',
      document_id: 'image',
      value_text: 'INR 9999',
      quote: 'Refund INR 9999',
      page: 1,
    },
  ],
  facts: [],
  events: [],
  questions: [],
  run: { id: 'run', status: 'plan_ready', phase: 'done', turn: 7 },
} as unknown as WorkspaceRows;
const rule: GuidanceRow = {
  id: 'rule',
  title: 'Scripted test rule',
  body: 'Scripted checked rule.',
  source_name: 'Scripted source',
  source_url: 'https://example.org/rule',
  checked_on: '2026-10-02',
  applies_to_steps: [0, 1, 3],
};
const proposal: PlanRow = {
  id: 'plan',
  case_id: 'case',
  user_id: 'owner',
  run_id: 'run',
  ladder_step: 1,
  summary: 'Ask for the overdue refund.',
  reasons: [{ text: 'The due date has passed.' }],
  dates: { refund_due: '2026-09-24' },
  guidance_ids: ['rule'],
  approved_at: null,
  rejected_at: null,
  sent_on: null,
  outcome: null,
  created_at: '2026-10-02T01:00:00Z',
  draft_claim_token: null,
  draft_claimed_at: null,
};

describe('real case screen', () => {
  const load = vi.fn();
  const sourceUrl = vi.fn();
  const start = vi.fn();
  const advance = vi.fn();
  const answer = vi.fn();
  const reviewPlan = vi.fn();
  const prepareDraft = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    load.mockResolvedValue(saved);
    sourceUrl.mockResolvedValue('https://example.test/support.png');
    prepareDraft.mockResolvedValue({ retryAfterMs: 1000 });
    TestBed.configureTestingModule({
      imports: [CaseWorkspace],
      providers: [
        provideRouter([]),
        {provide:CasesService,useValue:{addReplyDocument:vi.fn()}},
        {
          provide: CaseWorkspaceService,
          useValue: { load, sourceUrl, start, advance, answer, reviewPlan, prepareDraft },
        },
      ],
    });
  });
  async function setup() {
    const fixture = TestBed.createComponent(CaseWorkspace);
    fixture.componentRef.setInput('caseId', 'case');
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
    expect(page.querySelector('app-source-panel img')?.getAttribute('src')).toBe(
      'https://example.test/support.png',
    );
    expect(start).not.toHaveBeenCalled();
    expect(advance).not.toHaveBeenCalled();
  });
  it('offers a retry for a failed source without restarting reading', async () => {
    sourceUrl.mockRejectedValueOnce(new Error('Could not open this document.'));
    const { fixture, page } = await setup();
    page.querySelector<HTMLButtonElement>('[data-fact-field="refund_amount"]')!.click();
    await fixture.whenStable();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Could not open');
    const retry = Array.from(page.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry opening'),
    )!;
    retry.click();
    await fixture.whenStable();
    expect(sourceUrl).toHaveBeenCalledTimes(2);
    expect(advance).not.toHaveBeenCalled();
  });
  it('uses roving keyboard tabs and labels the visible panel', async () => {
    const { fixture, page } = await setup();
    const tab = page.querySelector<HTMLButtonElement>('#case-tab-facts')!;
    tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(page.querySelector('#case-tab-activity')?.getAttribute('aria-selected')).toBe('true');
    expect(page.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe(
      'case-tab-activity',
    );
    expect(page.querySelectorAll('[role="tab"][tabindex="0"]')).toHaveLength(1);
  });
  it('shows a plain unavailable-case message and My cases link', async () => {
    load.mockRejectedValue(new Error('This case is not available in this browser.'));
    const { page } = await setup();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('not available');
    expect(page.querySelector('a')?.getAttribute('href')).toBe('/cases');
  });
  it('shows one stored conflict question and resumes after its answer without a reload', async () => {
    const waiting = {
      ...saved,
      run: { ...saved.run!, status: 'waiting_for_user' },
      questions: [
        {
          id: 'q',
          run_id: 'run',
          kind: 'conflict',
          field: 'refund_amount',
          prompt: 'Which refund amount?',
          options: [{ id: 'one', label: 'INR 9999', value: 'INR 9999' }],
          answer: null,
          answered_at: null,
        },
      ],
    } as WorkspaceRows;
    load
      .mockResolvedValueOnce(waiting)
      .mockResolvedValue({
        ...saved,
        run: { ...saved.run!, status: 'running', phase: 'investigating', turn: 8 },
      });
    answer.mockResolvedValue({ run: { ...saved.run!, status: 'running' }, events: [] });
    advance.mockResolvedValue({
      run: { ...saved.run!, status: 'plan_ready', phase: 'done' },
      events: [],
    });
    const { fixture, page } = await setup();
    expect(page.querySelectorAll('app-question-card')).toHaveLength(1);
    expect(page.textContent).toContain(
      'Answer the question below to continue. Your progress is saved.',
    );
    page.querySelector<HTMLButtonElement>('app-question-card button')!.click();
    await fixture.whenStable();
    expect(answer).toHaveBeenCalledExactlyOnceWith('q', { optionId: 'one' });
    expect(advance).toHaveBeenCalledTimes(1);
    expect(page.querySelector('app-question-card')).toBeNull();
  });
  it.each([0, 1])(
    'opens the saved step %s plan with its checked source and no draft or model call',
    async (step) => {
      load.mockResolvedValue({
        ...saved,
        plan: { ...proposal, ladder_step: step },
        guidance: [rule],
      });
      const { page } = await setup();
      expect(page.querySelector('#case-tab-plan')?.getAttribute('aria-selected')).toBe('true');
      expect(page.querySelector('app-plan-panel')?.textContent).toContain('Scripted checked rule.');
      expect(page.querySelector('app-plan-panel')?.textContent).toContain('checked 2026-10-02');
      expect(page.querySelector('app-plan-panel a')?.getAttribute('href')).toBe(rule.source_url);
      expect(page.querySelector('app-complaint-draft')).toBeNull();
      expect(advance).not.toHaveBeenCalled();
      if (step === 0) expect(page.textContent).toContain('nothing to send yet');
    },
  );
  it.each(['approve', 'reject', 'change'] as const)(
    'persists %s and prepares a complaint only after approval',
    async (action) => {
      const pending = { ...saved, plan: proposal, guidance: [rule] };
      load
        .mockResolvedValueOnce(pending)
        .mockResolvedValue({
          ...pending,
          plan: {
            ...proposal,
            approved_at: action === 'approve' ? '2026-10-02' : null,
            rejected_at: action === 'approve' ? null : '2026-10-02',
          },
          run: { ...saved.run!, status: action === 'change' ? 'waiting_for_user' : 'completed' },
          questions:
            action === 'change'
              ? [
                  {
                    id: 'change-question',
                    kind: 'confirm',
                    field: null,
                    prompt: 'What would you like to change in this plan?',
                    options: [],
                    answer: null,
                    answered_at: null,
                  },
                ]
              : [],
        });
      reviewPlan.mockResolvedValue(undefined);
      const { page, fixture } = await setup();
      const label =
        action === 'approve'
          ? 'Approve and'
          : action === 'reject'
            ? 'Reject this'
            : 'Request a change';
      Array.from(page.querySelectorAll<HTMLButtonElement>('app-plan-panel button'))
        .find((button) => button.textContent?.includes(label))!
        .click();
      await fixture.whenStable();
      expect(reviewPlan).toHaveBeenCalledExactlyOnceWith('plan', action);
      expect(advance).not.toHaveBeenCalled();
      if (action === 'approve') expect(prepareDraft).toHaveBeenCalledExactlyOnceWith('plan');
      else expect(prepareDraft).not.toHaveBeenCalled();
      if (action === 'approve') expect(page.textContent).toContain('You approved this plan.');
      if (action === 'change') {
        expect(page.textContent).toContain('Needs your answer');
        expect(page.textContent).toContain('Your requested change will be considered');
      }
    },
  );
  it('never drafts an approved wait plan', async () => {
    const pending = { ...saved, plan: { ...proposal, ladder_step: 0 }, guidance: [rule] };
    load
      .mockResolvedValueOnce(pending)
      .mockResolvedValue({ ...pending, plan: { ...pending.plan, approved_at: '2026-10-02' } });
    const { page, fixture } = await setup();
    Array.from(page.querySelectorAll<HTMLButtonElement>('app-plan-panel button'))
      .find((b) => b.textContent?.includes('Accept'))!
      .click();
    await fixture.whenStable();
    expect(prepareDraft).not.toHaveBeenCalled();
  });
  it('offers the wait date as a local calendar file without investigation or drafting', async () => {
    const waitingPlan = { ...proposal, ladder_step: 0, dates: { refund_due: '2026-10-10' } };
    load.mockResolvedValue({ ...saved, plan: waitingPlan, guidance: [rule] });
    const { page } = await setup();
    expect(Array.from(page.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Add refund date to calendar'))).toBeDefined();
    expect(start).not.toHaveBeenCalled();
    expect(advance).not.toHaveBeenCalled();
    expect(prepareDraft).not.toHaveBeenCalled();
  });
  it('keeps step three information only without an approval button', async () => {
    load.mockResolvedValue({ ...saved, plan: { ...proposal, ladder_step: 3 }, guidance: [rule] });
    const { page } = await setup();
    expect(page.textContent).toContain('Information only.');
    expect(page.querySelectorAll('app-plan-panel button')).toHaveLength(0);
  });
  it('accepts waiting dates for an already sent step-one complaint without preparing another letter',async()=>{
    const waiting={...saved,plan:{...proposal,sent_on:'2026-10-01'},guidance:[rule]};
    load.mockResolvedValueOnce(waiting).mockResolvedValue({...waiting,plan:{...waiting.plan,approved_at:'2026-10-02'}});
    const {fixture,page}=await setup();
    expect(page.textContent).toContain('already recorded as sent');
    Array.from(page.querySelectorAll<HTMLButtonElement>('app-plan-panel button')).find(b=>b.textContent?.includes('Accept this waiting plan'))!.click();
    await fixture.whenStable();expect(prepareDraft).not.toHaveBeenCalled();
  });
});
