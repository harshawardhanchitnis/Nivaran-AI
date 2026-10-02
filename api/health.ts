// GET /api/health: is the server up, and which settings are present? Reports booleans only,
// never values.
import type { HealthResponse } from '../shared/api.js';
import { readEnv } from '../server/env.js';
import { handle, json } from '../server/http.js';

export const GET = handle(() => {
  const env = readEnv();
  const body: HealthResponse = {
    ok: true,
    service: 'nivaran-ai',
    time: new Date().toISOString(),
    region: process.env['VERCEL_REGION'] ?? 'local',
    configured: {
      supabase: Boolean(env.supabaseUrl && env.supabasePublishableKey),
      primaryModel: Boolean(env.googleApiKey),
      fallbackModel: Boolean(env.groqApiKey),
    },
  };
  return json(body);
});
