import { normaliseDate } from '../../shared/normalise.js';
import type { SentPlanResult } from '../../shared/database.js';
import { HttpError } from '../http.js';
export async function markPlanSent(
  save: (id: string, sentOn: string, today: string) => Promise<SentPlanResult | null>,
  planId: string,
  sentOn: string,
  today: string,
): Promise<SentPlanResult> {
  if (normaliseDate(sentOn) !== sentOn || sentOn > today)
    throw new HttpError(
      400,
      'invalid_sent_date',
      'Use the date you sent the complaint, on or before today in India.',
    );
  const result = await save(planId, sentOn, today);
  if (!result)
    throw new HttpError(
      409,
      'sent_date_unavailable',
      'Approve and prepare your grievance officer complaint before recording it as sent. Reload your case if the plan has changed.',
    );
  return result;
}
