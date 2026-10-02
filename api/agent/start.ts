import { agentStartRequestSchema, type AgentStartResponse } from '../../shared/api.js';
import { requireUser } from '../../server/auth.js';
import { handle, json, readJson } from '../../server/http.js';
import { startReading } from '../../server/agent/start.js';
import { createReadingStore } from '../../server/agent/store.js';

export const POST = handle(async (request) => {
  const { supabase } = await requireUser(request);
  const { caseId } = await readJson(request, agentStartRequestSchema);
  const body: AgentStartResponse = { run: await startReading(createReadingStore(supabase), caseId) };
  return json(body);
});
