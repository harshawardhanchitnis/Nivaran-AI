import { beforeEach,describe,expect,it,vi } from 'vitest';
import { deleteCase } from '../../server/cases/delete-case.js';
import type { CaseDeletionStore } from '../../server/cases/delete-case.js';
const owner='11111111-1111-4111-8111-111111111111',caseId='22222222-2222-4222-8222-222222222222';
const prefix=`${owner}/${caseId}`;
describe('user-confirmed case deletion',()=>{
  let store:CaseDeletionStore;
  beforeEach(()=>{
    store={ownedCase:vi.fn().mockResolvedValue(true),hasActiveClaim:vi.fn().mockResolvedValue(false),
      documentPaths:vi.fn().mockResolvedValue([prefix+'/invoice.pdf']),list:vi.fn().mockResolvedValueOnce(['invoice.pdf','orphan.pdf']).mockResolvedValue([]),
      remove:vi.fn().mockResolvedValue(undefined),removeCase:vi.fn().mockResolvedValue(undefined)};
  });
  it('removes recorded and orphan storage files before rows, then supports a replay',async()=>{
    expect(await deleteCase(store,owner,caseId)).toEqual({deleted:true});
    expect(store.remove).toHaveBeenCalledWith([prefix+'/invoice.pdf',prefix+'/orphan.pdf']);
    expect(vi.mocked(store.remove).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(store.removeCase).mock.invocationCallOrder[0]!);
    vi.mocked(store.ownedCase).mockResolvedValue(false);
    await deleteCase(store,owner,caseId);expect(store.removeCase).toHaveBeenCalledOnce();
  });
  it('retains rows if storage fails or is still nonempty',async()=>{
    vi.mocked(store.remove).mockRejectedValue(new Error('Storage offline'));
    await expect(deleteCase(store,owner,caseId)).rejects.toThrow();expect(store.removeCase).not.toHaveBeenCalled();
    vi.mocked(store.remove).mockResolvedValue(undefined);vi.mocked(store.list).mockResolvedValue(['remaining.pdf']);
    await expect(deleteCase(store,owner,caseId)).rejects.toThrow();expect(store.removeCase).not.toHaveBeenCalled();
  });
  it.each([`${owner}/other-case/invoice.pdf`,prefix+'/../foreign.pdf',prefix+'/folder/file.pdf',prefix+'/bad\\path.pdf'])('refuses unexpected path %s without deleting anything',async path=>{
    vi.mocked(store.documentPaths).mockResolvedValue([path]);
    await expect(deleteCase(store,owner,caseId)).rejects.toThrow(/unexpected file path/);
    expect(store.remove).not.toHaveBeenCalled();expect(store.removeCase).not.toHaveBeenCalled();
  });
  it('does not touch hidden foreign cases or a current claimed step',async()=>{
    vi.mocked(store.ownedCase).mockResolvedValue(false);await deleteCase(store,owner,caseId);expect(store.list).not.toHaveBeenCalled();
    vi.mocked(store.ownedCase).mockResolvedValue(true);vi.mocked(store.hasActiveClaim).mockResolvedValue(true);
    await expect(deleteCase(store,owner,caseId)).rejects.toThrow(/still finishing/);expect(store.remove).not.toHaveBeenCalled();
  });
  it('checks a second storage page without broadening the case prefix',async()=>{
    vi.mocked(store.list).mockReset().mockResolvedValueOnce(Array.from({length:100},(_,i)=>`orphan-${i}.pdf`)).mockResolvedValueOnce(['last.pdf']).mockResolvedValue([]);
    await deleteCase(store,owner,caseId);
    expect(store.list).toHaveBeenNthCalledWith(2,prefix,100);
    expect(store.remove).toHaveBeenCalledTimes(2);
  });
});
