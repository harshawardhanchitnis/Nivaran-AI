import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanRow } from '../../shared/database.js';
import { context } from '../fixtures/draft.js';
const fake = vi.hoisted(() => ({ text: vi.fn(), route: vi.fn(), create: vi.fn() }));
vi.mock('ai', () => ({ generateText: fake.text }));
vi.mock('../../server/llm/routed-call.js', () => ({ createRoutedModelCall: fake.create }));
import { createDraftGenerator } from '../../server/draft/model.js';
describe('tool-free routed draft generation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fake.text.mockResolvedValue({ text: 'Refund {{fact:refund_amount}}. {{you:name}}' });
    fake.route.mockImplementation(async (task, attempt) => ({
      value: await attempt({ model: 'fake' }, new AbortController().signal),
      modelId: 'answering-model',
    }));
    fake.create.mockReturnValue(fake.route);
  });
  it('routes prose as text, with placeholders, no raw fact values, no tools or SDK retries', async () => {
    const start = Date.now();
    const client = {} as SupabaseClient;
    const generate = createDraftGenerator(client);
    const answer = await generate(
      { ladder_step: 1, summary: 'Overdue refund.', dates: context.dates } as PlanRow,
      { ...context, guidance: [] },
      false,
    );
    expect(answer.modelId).toBe('answering-model');
    expect(fake.create).toHaveBeenCalledWith(client, { deadline: expect.any(Number) });
    expect(fake.create.mock.calls[0]![1].deadline - start).toBeGreaterThanOrEqual(45000);
    expect(fake.route.mock.calls[0]![0]).toBe('text');
    const args = fake.text.mock.calls[0]![0];
    expect(args.maxRetries).toBe(0);
    expect(args.tools).toBeUndefined();
    expect(args.abortSignal).toBeInstanceOf(AbortSignal);
    expect(args.prompt).toContain('{{fact:refund_amount}}');
    expect(args.prompt).not.toContain('9999');
    expect(args.prompt).not.toContain('MM-123456');
  });
});
