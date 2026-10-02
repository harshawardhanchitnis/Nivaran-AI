// Supabase access for Vercel Functions.
//
// Rule: the server acts as the signed-in user. Every client is built from the caller's own access
// token and the publishable key, so row-level security applies to everything the agent does.
// There is no service-role or secret key anywhere in this project.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { type ServerEnv, readEnv } from './env.js';
import { HttpError } from './http.js';

export function createUserClient(accessToken: string, env: ServerEnv = readEnv()): SupabaseClient {
  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    throw new HttpError(503, 'not_configured', 'The server is missing its Supabase settings.');
  }
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
