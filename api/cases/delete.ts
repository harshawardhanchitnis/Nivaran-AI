import { caseDeleteRequestSchema } from '../../shared/api.js';
import { requireUser } from '../../server/auth.js';
import { handle,json,readJson } from '../../server/http.js';
import { createCaseDeletionStore,deleteCase } from '../../server/cases/delete-case.js';
export const POST=handle(async request=>{
  const {supabase,userId}=await requireUser(request);
  const {caseId}=await readJson(request,caseDeleteRequestSchema);
  return json(await deleteCase(createCaseDeletionStore(supabase,userId),userId,caseId));
});
