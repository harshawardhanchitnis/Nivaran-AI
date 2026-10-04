import { beforeEach,describe,expect,it,vi } from 'vitest';
const fake=vi.hoisted(()=>({requireUser:vi.fn(),createStore:vi.fn(),remove:vi.fn()}));
vi.mock('../../server/auth.js',()=>({requireUser:fake.requireUser}));
vi.mock('../../server/cases/delete-case.js',()=>({createCaseDeletionStore:fake.createStore,deleteCase:fake.remove}));
import { POST } from '../../api/cases/delete.js';
import { HttpError } from '../../server/http.js';
const caseId='11111111-1111-4111-8111-111111111111';
const request=(body:unknown)=>new Request('http://localhost/api/cases/delete',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();fake.requireUser.mockResolvedValue({supabase:{},userId:'caller'});fake.createStore.mockReturnValue('caller-store');fake.remove.mockResolvedValue({deleted:true});});
describe('case deletion API',()=>{
  it('requires caller authentication and explicit confirmation',async()=>{
    fake.requireUser.mockRejectedValueOnce(new HttpError(401,'unauthenticated','Sign in.'));
    expect((await POST(request({caseId,confirmed:true}))).status).toBe(401);
    expect((await POST(request({caseId}))).status).toBe(400);
    expect((await POST(request({caseId:'../other',confirmed:true}))).status).toBe(400);
    expect(fake.remove).not.toHaveBeenCalled();
  });
  it('uses the authenticated owner, ignoring body user IDs',async()=>{
    const response=await POST(request({caseId,confirmed:true,userId:'foreign'}));expect(response.status).toBe(200);
    expect(fake.remove).toHaveBeenCalledWith('caller-store','caller',caseId);
  });
});
