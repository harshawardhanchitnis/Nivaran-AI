import type { AgentAdvanceResponse } from '../../shared/api.js';
import type { AgentEventType, AgentRunRow, DocumentReadStatus, DocumentRow } from '../../shared/database.js';
import { HttpError } from '../http.js';
import type { ModelRole } from '../llm/provider.js';
import type { ReadDocumentResult } from '../reader/read-document.js';
import { readEnv } from '../env.js';

export class StaleTurnError extends HttpError {
  constructor(readonly run: AgentRunRow) {
    super(409, 'stale_turn', 'This case has moved on or another request is reading it. Refresh its progress.');
  }
}
export interface FinishReading {
  run: AgentRunRow;
  documentId: string | null;
  result: ReadDocumentResult | null;
  readStatus: DocumentReadStatus;
  readerState: AgentRunRow['reader_state'];
  event: { type: AgentEventType; payload: Record<string, unknown> };
  model: string | null;
}
export interface ReadingStore {
  getRun(id: string): Promise<AgentRunRow>;
  claim(id: string, turn: number): Promise<AgentRunRow | null>;
  release(run: AgentRunRow): Promise<void>;
  pendingDocument(caseId: string, fallbackId?: string): Promise<DocumentRow | null>;
  finish(input: FinishReading): Promise<AgentAdvanceResponse | null>;
}
export type DocumentReader = (document: DocumentRow, role: ModelRole) => Promise<ReadDocumentResult>;

export function rateLimitDelay(error: unknown): number | null {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== 'object') return null;
    const entry = current as Record<string, unknown>;
    if (entry['statusCode'] === 429) {
      const headers = entry['responseHeaders'];
      const raw = headers && typeof headers === 'object' ? (headers as Record<string, unknown>)['retry-after'] : undefined;
      const seconds = typeof raw === 'string' ? Number(raw) : NaN;
      return Number.isFinite(seconds) && seconds > 0 ? Math.min(300_000, Math.ceil(seconds * 1000)) : 60_000;
    }
    current = entry['cause'] ?? entry['lastError'];
  }
  return null;
}

function failureDetails(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') return { name: 'unknown_error' };
  const details = error as Record<string, unknown>;
  const env = readEnv();
  let message = error instanceof Error ? error.message : 'Model output could not be read.';
  for (const secret of [env.googleApiKey, env.groqApiKey, env.supabasePublishableKey]) {
    if (secret) message = message.replaceAll(secret, '[redacted]');
  }
  return { name: error instanceof Error ? error.name : 'provider_error',
    ...(typeof details['statusCode'] === 'number' ? { status: details['statusCode'] } : {}),
    message: message.slice(0, 500) };
}

export async function advanceReading(store: ReadingStore, read: DocumentReader, runId: string, expectedTurn: number): Promise<AgentAdvanceResponse> {
  const run = await store.claim(runId, expectedTurn);
  if (!run) throw new StaleTurnError(await store.getRun(runId));
  let finished = false;
  try {
    if (run.phase !== 'reading') {
      throw new HttpError(409, 'reading_finished', 'Document reading has finished. Investigation is the next stage.');
    }
    const document = await store.pendingDocument(run.case_id, run.reader_state.fallback_document_id);
    let result: ReadDocumentResult | null = null;
    let readStatus: DocumentReadStatus = 'read';
    let readerState: AgentRunRow['reader_state'] = {};
    const role = document && run.reader_state.fallback_document_id === document.id ? 'fallback' : 'primary';
    let event: FinishReading['event'];
    if (!document) {
      event = { type: 'decision', payload: { action: 'reading_complete', message: 'Finished reading the documents.' } };
    } else {
      try {
        result = await read(document, role);
        readStatus = result.readable ? 'read' : 'unreadable';
        event = { type: 'tool_result', payload: { tool: 'read_document', documentId: document.id,
          label: document.label, role, readStatus, factCount: result.facts.length,
          message: result.readable ? `Read ${document.label}.` : `Could not read ${document.label}. Please add a clearer copy.` } };
      } catch (error) {
        if (error instanceof HttpError) throw error;
        const retryAfterMs = rateLimitDelay(error);
        if (retryAfterMs !== null) {
          return { run: { ...run, processing_token: null, processing_started_at: null }, events: [], retryAfterMs };
        }
        const fallback = role === 'primary' && document.mime_type !== 'application/pdf';
        readStatus = fallback ? 'pending' : 'failed';
        readerState = fallback ? { fallback_document_id: document.id } : {};
        event = { type: 'error', payload: { tool: 'read_document', documentId: document.id, label: document.label,
          role, readStatus, diagnostic: failureDetails(error),
          message: fallback ? `Could not read ${document.label} with the primary model. Trying the fallback next.`
            : `The model could not read ${document.label}. This document needs another attempt.` } };
      }
    }
    const response = await store.finish({ run, documentId: document?.id ?? null, result, readStatus, readerState,
      event, model: result?.modelId ?? null });
    if (!response) throw new StaleTurnError(await store.getRun(runId));
    finished = true;
    return response;
  } finally {
    if (!finished) await store.release(run);
  }
}
