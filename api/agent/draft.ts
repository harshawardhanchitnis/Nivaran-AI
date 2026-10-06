import { agentDraftRequestSchema } from '../../shared/api.js';
import { requireUser } from '../../server/auth.js';
import { handle, json, readJson } from '../../server/http.js';
import { createDraftStore } from '../../server/draft/store.js';
import { createDraftGenerator } from '../../server/draft/model.js';
import { writeDraft } from '../../server/draft/write-draft.js';
import { indiaToday } from '../../server/ladder/dates.js';
import { ModelsUnavailableError } from '../../server/llm/router.js';
export const POST = handle(async (request) => {
  const { supabase } = await requireUser(request);
  const input = await readJson(request, agentDraftRequestSchema);
  try {
    return json({
      draft: await writeDraft(
        createDraftStore(supabase),
        { generate: createDraftGenerator(supabase), today: indiaToday },
        input.planId,
        input.mode,
      ),
    });
  } catch (error) {
    if (error instanceof ModelsUnavailableError) return json({ retryAfterMs: error.retryAfterMs });
    throw error;
  }
});
