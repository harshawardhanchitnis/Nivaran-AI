import { agentAdvanceRequestSchema } from '../../shared/api.js';
import { requireUser } from '../../server/auth.js';
import { handle, json, readJson } from '../../server/http.js';
import { advanceReading, StaleTurnError } from '../../server/agent/reading.js';
import { createReadingStore } from '../../server/agent/store.js';
import { createDocumentReader } from '../../server/reader/read-document.js';

export const POST = handle(async (request) => {
  const { supabase } = await requireUser(request);
  const { runId, expectedTurn } = await readJson(request, agentAdvanceRequestSchema);
  try {
    return json(await advanceReading(createReadingStore(supabase), createDocumentReader(supabase), runId, expectedTurn));
  } catch (error) {
    if (error instanceof StaleTurnError) {
      return json({ error: { code: error.code, message: error.message }, run: error.run }, 409);
    }
    throw error;
  }
});
