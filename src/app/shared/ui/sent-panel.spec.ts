import { TestBed } from '@angular/core/testing';
import { SentPanel } from './sent-panel';
describe('recorded sent date controls', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [SentPanel] });
    const fixture = TestBed.createComponent(SentPanel);
    fixture.componentRef.setInput('plan', { sentOn: null, acknowledgeBy: null, resolveBy: null });
    fixture.componentRef.setInput('today', '2026-10-02');
    await fixture.whenStable();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }
  it('does not imply that Nivaran sends, and emits only a past or current date', async () => {
    const { fixture, page } = await setup();
    expect(page.textContent).toContain('does not send or file');
    let recorded: string | undefined;
    fixture.componentInstance.recordRequested.subscribe((date) => (recorded = date));
    const input = page.querySelector<HTMLInputElement>('input')!;
    input.value = '2026-10-03';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(page.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    input.value = '2026-10-01';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('button')!.click();
    expect(recorded).toBe('2026-10-01');
  });
  it('shows recorded deadlines with the receipt caveat and offers a local calendar file', async () => {
    const { fixture, page } = await setup();
    fixture.componentRef.setInput('plan', {
      sentOn: '2026-10-01',
      acknowledgeBy: '2026-10-03',
      resolveBy: '2026-11-01',
    });
    await fixture.whenStable();
    expect(page.textContent).toContain('2026-11-01');
    expect(page.textContent).toContain('receipt of the complaint');
    let count = 0;
    fixture.componentInstance.calendarRequested.subscribe(() => count++);
    Array.from(page.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('calendar'))!
      .click();
    expect(count).toBe(1);
  });
});
