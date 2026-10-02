// GET /api/whoami: proves the whole auth chain. The browser's token is verified, then used for a
// database read, so row-level security decides what comes back.
import type { WhoAmIResponse } from '../shared/api.js';
import { requireUser } from '../server/auth.js';
import { handle, json } from '../server/http.js';

export const GET = handle(async (request) => {
  const { supabase, userId, isAnonymous } = await requireUser(request);

  const { count, error } = await supabase.from('cases').select('id', { count: 'exact', head: true });

  const body: WhoAmIResponse = {
    userId,
    isAnonymous,
    database: error ? { ok: false, message: error.message } : { ok: true, caseCount: count ?? 0 },
  };
  return json(body);
});
