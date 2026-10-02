import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EVIDENCE_BUCKET } from '@shared/limits';
import { ApiService } from './api.service';
import { SupabaseService } from './supabase.service';
import { CaseWorkspaceService } from './case-workspace.service';

describe('CaseWorkspaceService', () => {
  const from = vi.fn(); const signed = vi.fn(); const bucket = vi.fn(); const post = vi.fn(); const rpc=vi.fn();
  const rows: Record<string, unknown[]> = {};
  let service: CaseWorkspaceService;
  beforeEach(() => {
    vi.resetAllMocks();
    Object.assign(rows, { cases: [{ id: 'case' }], documents: [], evidence_items: [], case_facts: [],
      agent_runs: [{ id: 'latest', turn: 7 }], agent_events: [{ run_id: 'older' }, { run_id: 'latest' }], plans:[],guidance:[] });
    from.mockImplementation((table: string) => {
      const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(),
        maybeSingle: async () => ({ data: rows[table]?.[0] ?? null, error: null }),
        returns: async () => ({ data: rows[table], error: null }) };
      for (const method of [query.select, query.eq, query.order, query.limit]) method.mockReturnValue(query);
      return query;
    });
    signed.mockResolvedValue({ data: { signedUrl: 'signed' }, error: null });
    bucket.mockReturnValue({ createSignedUrl: signed });
    TestBed.configureTestingModule({ providers: [
      { provide: SupabaseService, useValue: { ensureSignedIn: async () => {}, client: { from,rpc, storage: { from: bucket } } } },
      { provide: ApiService, useValue: { post } },
    ] });
    service = TestBed.inject(CaseWorkspaceService);
  });
  it('loads caller-scoped saved rows and only events from the latest run', async () => {
    const data = await service.load('case');
    expect(data.run?.turn).toBe(7); expect(data.events).toEqual([{ run_id: 'latest' }]);
    for (const [index,result] of from.mock.results.entries()) {
      if(from.mock.calls[index]?.[0]==='guidance') continue;
      const query = result.value as { eq: ReturnType<typeof vi.fn> };
      expect(query.eq).toHaveBeenCalledWith(result === from.mock.results[0] ? 'id' : 'case_id', 'case');
    }
    expect(post).not.toHaveBeenCalled();
  });
  it('reviews a plan through one caller-scoped transaction without a model call',async()=> {
    rpc.mockResolvedValue({data:{plan:{id:'plan'}},error:null});
    await service.reviewPlan('plan','approve');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('review_plan',{p_plan_id:'plan',p_action:'approve'});
    expect(post).not.toHaveBeenCalled();
  });
  it('does not try to start or load children of an unavailable case', async () => {
    rows['cases'] = [];
    await expect(service.load('gone')).rejects.toThrow('not available in this browser');
    expect(from).toHaveBeenCalledTimes(1); expect(post).not.toHaveBeenCalled();
  });
  it('requests a short-lived private URL without making a model call', async () => {
    const document = { storage_path: 'owner/case/source.png' } as Parameters<CaseWorkspaceService['sourceUrl']>[0];
    expect(await service.sourceUrl(document)).toBe('signed');
    expect(bucket).toHaveBeenCalledWith(EVIDENCE_BUCKET);
    expect(signed).toHaveBeenCalledWith(document.storage_path, 600);
    expect(post).not.toHaveBeenCalled();
  });
});
