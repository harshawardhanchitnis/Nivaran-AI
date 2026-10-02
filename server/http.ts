// Small helpers shared by every Vercel Function. Handlers use the web-standard signature:
//   export const GET = handle(async (request) => json({ ... }));
import { z } from 'zod';

import type { ApiErrorBody } from '../shared/api.js';

/** An error that is safe to show to the caller. Anything else becomes a generic 500. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
} as const;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    const body: ApiErrorBody = { error: { code: error.code, message: error.message } };
    return json(body, error.status);
  }
  // Never leak internals: log for the function logs, answer with a generic message.
  console.error('[api] unhandled error', error);
  const body: ApiErrorBody = {
    error: { code: 'internal_error', message: 'Something went wrong on our side. Please try again.' },
  };
  return json(body, 500);
}

export type Handler = (request: Request) => Promise<Response> | Response;

/** Wraps a handler so that thrown errors always become a JSON error response. */
export function handle(handler: Handler): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Parses and validates a JSON request body. An empty body is treated as `{}`. */
export async function readJson<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<z.output<Schema>> {
  const text = await request.text();
  let raw: unknown = {};
  if (text.trim() !== '') {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new HttpError(400, 'invalid_json', 'The request body is not valid JSON.');
    }
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first && first.path.length > 0 ? ` (${first.path.join('.')})` : '';
    throw new HttpError(400, 'invalid_request', `The request is not valid${where}: ${first?.message ?? 'unknown problem'}.`);
  }
  return result.data;
}
