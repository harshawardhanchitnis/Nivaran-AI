import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { CasesService, CaseUploadError } from '../../core/cases.service';
import { CaseNew } from './case-new';

describe('CaseNew upload actions', () => {
  const create = vi.fn();

  beforeEach(() => {
    create.mockReset().mockResolvedValue({ case: { id: 'new-case' }, documents: [] });
    TestBed.configureTestingModule({
      imports: [CaseNew], providers: [provideRouter([]), { provide: CasesService, useValue: { createWithDocuments: create } }],
    });
  });

  async function setup() {
    const fixture = TestBed.createComponent(CaseNew);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    const picker = page.querySelector<HTMLInputElement>('input[type="file"]')!;
    const consent = page.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const continueButton = page.querySelector<HTMLButtonElement>('button[mat-flat-button]')!;
    const pick = () => {
      Object.defineProperty(picker, 'files', { configurable: true, value: [new File(['test'], 'invoice.png', { type: 'image/png' })] });
      picker.dispatchEvent(new Event('change'));
    };
    return { fixture, page, picker, consent, continueButton, pick, navigate };
  }

  it('keeps file picking and Continue disabled until consent, and still guards an emitted file', async () => {
    const ui = await setup();
    expect(ui.picker.disabled).toBe(true);
    expect(ui.continueButton.disabled).toBe(true);
    ui.pick();
    await ui.fixture.whenStable();
    expect(ui.page.querySelector('ul.files')).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('uploads once and opens the new case after consent', async () => {
    const ui = await setup();
    ui.consent.click();
    await ui.fixture.whenStable();
    ui.pick();
    await ui.fixture.whenStable();
    expect(ui.continueButton.disabled).toBe(false);
    ui.continueButton.click();
    ui.continueButton.click();
    await ui.fixture.whenStable();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![1]).toBe(true);
    expect(ui.navigate).toHaveBeenCalledWith(['/cases', 'new-case']);
  });

  it('retries opening a saved case without uploading it again', async () => {
    const ui = await setup();
    ui.navigate.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    ui.consent.click();
    await ui.fixture.whenStable();
    ui.pick();
    await ui.fixture.whenStable();
    ui.continueButton.click();
    await ui.fixture.whenStable();
    expect(ui.page.textContent).toContain('Your documents are saved');
    ui.continueButton.click();
    await ui.fixture.whenStable();
    expect(create).toHaveBeenCalledTimes(1);
    expect(ui.navigate).toHaveBeenCalledTimes(2);
  });

  it('shows a recoverable upload error and a link when a partial case remains', async () => {
    create.mockRejectedValue(new CaseUploadError('A partial case is saved.', 'partial-case'));
    const ui = await setup();
    ui.consent.click();
    await ui.fixture.whenStable();
    ui.pick();
    await ui.fixture.whenStable();
    ui.continueButton.click();
    await ui.fixture.whenStable();
    expect(ui.page.querySelector('[role="alert"]')?.textContent).toContain('partial case');
    expect(ui.page.querySelector('a')?.getAttribute('href')).toBe('/cases/partial-case');
    expect(ui.continueButton.disabled).toBe(false);
  });
});
