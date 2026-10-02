import { agentDraftEditRequestSchema } from '../../shared/api.js';
import { requireUser } from '../../server/auth.js';
import { handle, json, readJson } from '../../server/http.js';
import { createDraftStore } from '../../server/draft/store.js';
import { saveDraftEdit } from '../../server/draft/save-edit.js';
import { indiaToday } from '../../server/ladder/dates.js';
export const POST = handle(async (request) => {
  const { supabase } = await requireUser(request);
  const input = await readJson(request, agentDraftEditRequestSchema);
  return json({ draft: await saveDraftEdit(createDraftStore(supabase), input, indiaToday()) });
});
