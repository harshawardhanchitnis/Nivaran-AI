import type { AgentRunRow } from '../../shared/database.js';
import { HttpError } from '../http.js';

export interface StartReadingStore {
  requireCase(id: string): Promise<void>;
  activeRun(caseId: string): Promise<AgentRunRow | null>;
  hasDocuments(caseId: string): Promise<boolean>;
  insertRun(caseId: string): Promise<AgentRunRow>;
}

export async function startReading(store: StartReadingStore, caseId: string): Promise<AgentRunRow> {
  await store.requireCase(caseId);
  const active = await store.activeRun(caseId);
  if (active) return active;
  if (!await store.hasDocuments(caseId)) {
    throw new HttpError(400, 'no_documents', 'Add at least one document before starting.');
  }
  try {
    return await store.insertRun(caseId);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      const winner = await store.activeRun(caseId);
      if (winner) return winner;
    }
    throw new HttpError(503, 'run_start_failed', 'Could not start reading your case. Please try again.');
  }
}
