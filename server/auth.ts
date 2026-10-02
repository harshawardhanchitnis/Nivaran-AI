// Turns the caller's `Authorization: Bearer <token>` header into a verified user plus a Supabase
// client that acts as that user.
import type { SupabaseClient } from '@supabase/supabase-js';

import { createUserClient } from './db.js';
import { type ServerEnv, readEnv } from './env.js';
import { HttpError } from './http.js';

export interface AuthedContext {
  /** Acts as the caller: row-level security applies. */
  supabase: SupabaseClient;
  userId: string;
  isAnonymous: boolean;
  accessToken: string;
}

export function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match?.[1]) {
    throw new HttpError(401, 'unauthenticated', 'Sign in to continue.');
  }
  return match[1];
}

export async function requireUser(request: Request, env: ServerEnv = readEnv()): Promise<AuthedContext> {
  const accessToken = bearerToken(request);
  const supabase = createUserClient(accessToken, env);

  // Verifies the signature and expiry (locally when the project uses asymmetric signing keys,
  // otherwise by asking the Auth server).
  const { data, error } = await supabase.auth.getClaims(accessToken);
  const userId = data?.claims.sub;
  if (error || !userId) {
    throw new HttpError(401, 'unauthenticated', 'Your session has expired. Please sign in again.');
  }

  return {
    supabase,
    userId,
    isAnonymous: data.claims['is_anonymous'] === true,
    accessToken,
  };
}
