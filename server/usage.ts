import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { HttpError } from './http.js';

const chargeSchema = z.object({ allowed: z.boolean(), reason: z.string().nullable().optional() });

/** Refuse closed: an unconfirmed charge must never reach a provider. */
export async function chargeModelCall(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.rpc('charge_model_call');
  const charge = chargeSchema.safeParse(data);
  if (error || !charge.success) {
    throw new HttpError(503, 'usage_check_failed', 'Could not check the model call limit. Please try again.');
  }
  if (!charge.data.allowed) {
    const limit = charge.data.reason === 'global_limit' ? 'The app\'s' : 'Your';
    throw new HttpError(429, 'quota_exhausted', `${limit} model call limit for today has been reached. Please try again tomorrow.`);
  }
}
