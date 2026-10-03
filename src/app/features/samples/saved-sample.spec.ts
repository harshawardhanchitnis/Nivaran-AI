import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type { SavedSample } from '@shared/samples';
import { SamplesService } from '../../core/samples.service';
import { CasesService } from '../../core/cases.service';
import { SavedSampleView } from './saved-sample';

describe('SavedSampleView', () => {
  it('shows saved records with no agent actions and hides live action when quota is unavailable', async () => {
    const saved = {id:'out-of-scope',title:'Outside scope',today:'2026-10-02',recordedAt:'2026-10-04T00:00:00Z',provenance:'final-stage-one, repetition 1',
      warning:'Document reading failed.',logicalCalls:2,providerAttempts:7,models:{'qwen/qwen3.8-27b':2},
      run:{status:'out_of_scope',phase:'done'},documents:[],facts:[],evidence:[],questions:[],events:[],plan:null,draft:null,guidance:[]} as unknown as SavedSample;
    const budget = vi.fn().mockRejectedValue(new Error('Offline'));
    TestBed.configureTestingModule({imports:[SavedSampleView],providers:[provideRouter([]),
      {provide:ActivatedRoute,useValue:{snapshot:{paramMap:new Map([['sampleId','out-of-scope']])}}},
      {provide:SamplesService,useValue:{load:vi.fn().mockResolvedValue(saved)}},
      {provide:CasesService,useValue:{modelBudget:budget}}]});
    const fixture = TestBed.createComponent(SavedSampleView); await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Saved run');
    expect(page.textContent).toContain('Document reading failed');
    expect(page.textContent).toContain('Opening this record makes no model calls');
    expect(page.querySelector('a[href*="/cases/new"]')).toBeNull();
    expect(budget).toHaveBeenCalledOnce();
  });
});
