import { markSentRequestSchema } from '../../shared/api.js';
import type { SentPlanResult } from '../../shared/database.js';
import { requireUser } from '../../server/auth.js';
import { handle, HttpError, json, readJson } from '../../server/http.js';
import { indiaToday } from '../../server/ladder/dates.js';
import { markPlanSent } from '../../server/plans/mark-sent.js';
export const POST = handle(async (request) => {
  const { supabase } = await requireUser(request);
  const input = await readJson(request, markSentRequestSchema);
  return json(
    await markPlanSent(
      async (id, sentOn, today) => {
        const { data, error } = await supabase.rpc('mark_plan_sent', {
          p_plan_id: id,
          p_sent_on: sentOn,
          p_today: today,
        });
        if (error)
          throw new HttpError(
            409,
            'sent_date_failed',
            'Could not record the sent date. Your case is safe; reload and try again.',
          );
        return data as SentPlanResult | null;
      },
      input.planId,
      input.sentOn,
      indiaToday(),
    ),
  );
});
