import type { AgentAdvanceResponse } from '@shared/api';
import type { AgentRunRow } from '@shared/database';
import { ApiError } from './api.service';

interface ReadingDependencies {
  start(): Promise<AgentRunRow>;
  advance(run: AgentRunRow): Promise<AgentAdvanceResponse>;
  current(): Promise<AgentRunRow | null>;
  refresh(): Promise<void>;
  wait(milliseconds: number): Promise<void>;
  delay(waiting: boolean): void;
  signal: AbortSignal;
}

/** Sequential requests; the next phase will be enabled when T5 implements investigation. */
export async function continueReading(initial: AgentRunRow | null, deps: ReadingDependencies): Promise<void> {
  if (deps.signal.aborted) return;
  let run = initial ?? await deps.start();
  let conflicts = 0;
  while (!deps.signal.aborted && run.status === 'running' && run.phase === 'reading') {
    try {
      const response = await deps.advance(run);
      if (deps.signal.aborted) return;
      run = response.run;
      conflicts = 0;
      await deps.refresh();
      if (response.retryAfterMs) {
        deps.delay(true);
        try { await deps.wait(response.retryAfterMs); } finally { deps.delay(false); }
      }
    } catch (error) {
      if (deps.signal.aborted) return;
      if (!(error instanceof ApiError) || error.code !== 'stale_turn' || conflicts >= 3) throw error;
      conflicts += 1;
      await deps.refresh();
      const current = await deps.current();
      if (!current) throw new Error('This run is no longer available. Open the case again.');
      run = current;
      // Allow a concurrent request to finish before asking for another claim.
      await deps.wait(1000 * conflicts);
    }
  }
}

export function waitForReading(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(); return; }
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener('abort', finish, { once: true });
  });
}
