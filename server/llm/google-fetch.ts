/**
 * Bridge the installed SDK's structured-output fields to Gemini's current REST format.
 * https://ai.google.dev/api/generate-content#TextResponseFormat
 * Document bytes, authorization, timeouts and retry policy pass through unchanged.
 */
export const googleFetch: typeof fetch = async (input, init) => {
  if (typeof init?.body !== 'string') return fetch(input, init);
  let body: unknown;
  try { body = JSON.parse(init.body); } catch { return fetch(input, init); }
  if (!body || typeof body !== 'object' || !('generationConfig' in body)) return fetch(input, init);
  const config = body.generationConfig;
  if (!config || typeof config !== 'object' || !('responseMimeType' in config) || config.responseMimeType !== 'application/json') {
    return fetch(input, init);
  }
  const settings = config as Record<string, unknown>;
  settings['responseFormat'] = { text: { mimeType: 'APPLICATION_JSON',
    ...(settings['responseJsonSchema'] ? { schema: settings['responseJsonSchema'] } : {}) } };
  delete settings['responseMimeType'];
  delete settings['responseJsonSchema'];
  return fetch(input, { ...init, body: JSON.stringify(body) });
};
