import { agentAnswerRequestSchema } from '../../shared/api.js';
import { requireUser } from '../../server/auth.js';
import { handle, json, readJson } from '../../server/http.js';
import { answerQuestion } from '../../server/agent/answer-question.js';
import { createInvestigationStore } from '../../server/agent/investigation-store.js';
import { createInvestigationDependencies } from '../../server/agent/runtime.js';
import { StaleTurnError } from '../../server/agent/reading.js';
export const POST = handle(async request => {
  const { supabase } = await requireUser(request);
  const input = await readJson(request, agentAnswerRequestSchema);
  try { return json(await answerQuestion(createInvestigationStore(supabase), createInvestigationDependencies(supabase), input)); }
  catch (error) {
    if (error instanceof StaleTurnError) return json({ error: { code: error.code, message: error.message }, run: error.run }, 409);
    throw error;
  }
});
