import { agentAdvanceRequestSchema } from '../../shared/api.js';
import { requireUser } from '../../server/auth.js';
import { handle, json, readJson } from '../../server/http.js';
import { advanceReading, StaleTurnError } from '../../server/agent/reading.js';
import { createReadingStore } from '../../server/agent/store.js';
import { createDocumentReader } from '../../server/reader/read-document.js';
import { advanceInvestigation } from '../../server/agent/loop.js';
import { createInvestigationStore } from '../../server/agent/investigation-store.js';
import { createInvestigationDependencies } from '../../server/agent/runtime.js';

export const POST = handle(async (request) => {
  const { supabase } = await requireUser(request);
  const { runId, expectedTurn } = await readJson(request, agentAdvanceRequestSchema);
  try {
    const store = createReadingStore(supabase);
    const run = await store.getRun(runId);
    return json(run.phase === 'reading'
      ? await advanceReading(store, createDocumentReader(supabase), runId, expectedTurn)
      : await advanceInvestigation(createInvestigationStore(supabase), createInvestigationDependencies(supabase), runId, expectedTurn));
  } catch (error) {
    if (error instanceof StaleTurnError) {
      return json({ error: { code: error.code, message: error.message }, run: error.run }, 409);
    }
    throw error;
  }
});
