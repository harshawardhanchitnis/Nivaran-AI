import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  requireUser: vi.fn(),
  store: {},
  generate: vi.fn(),
  write: vi.fn(),
  edit: vi.fn(),
}));
vi.mock('../../server/auth.js', () => ({ requireUser: fake.requireUser }));
vi.mock('../../server/draft/store.js', () => ({ createDraftStore: () => fake.store }));
vi.mock('../../server/draft/model.js', () => ({ createDraftGenerator: () => fake.generate }));
vi.mock('../../server/draft/write-draft.js', () => ({ writeDraft: fake.write }));
vi.mock('../../server/draft/save-edit.js', () => ({ saveDraftEdit: fake.edit }));
import { POST as draft } from '../../api/agent/draft.js';
import { POST as edit } from '../../api/agent/draft-edit.js';
import { HttpError } from '../../server/http.js';
import { ModelsUnavailableError } from '../../server/llm/router.js';
const id = '44444444-4444-4444-8444-444444444444';
const request = (body: unknown) =>
  new Request('http://localhost/api/agent/draft', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  fake.requireUser.mockResolvedValue({ supabase: {} });
  fake.write.mockResolvedValue({ id });
  fake.edit.mockResolvedValue({ id });
});
describe('draft endpoints', () => {
  it('validates IDs and authentication before generating', async () => {
    expect((await draft(request({ planId: 'bad' }))).status).toBe(400);
    expect(fake.write).not.toHaveBeenCalled();
    fake.requireUser.mockRejectedValue(new HttpError(401, 'unauthenticated', 'Sign in.'));
    expect((await draft(request({ planId: id }))).status).toBe(401);
  });
  it('uses the caller store and returns its saved draft', async () => {
    const response = await draft(request({ planId: id }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ draft: { id } });
    expect(fake.write).toHaveBeenCalledWith(
      fake.store,
      expect.objectContaining({ generate: fake.generate }),
      id,
      'model',
    );
  });
  it('reports all-model cooldowns and daily quota separately', async () => {
    fake.write.mockRejectedValueOnce(new ModelsUnavailableError(1234));
    const retry = await draft(request({ planId: id }));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ retryAfterMs: 1234 });
    fake.write.mockRejectedValue(new HttpError(429, 'quota_exhausted', 'Daily limit reached.'));
    expect((await draft(request({ planId: id }))).status).toBe(429);
  });
  it('accepts only an explicit supported recovery mode', async () => {
    expect((await draft(request({ planId: id, mode: 'basic' }))).status).toBe(200);
    expect(fake.write.mock.calls[0]?.[3]).toBe('basic');
    fake.write.mockClear();
    expect((await draft(request({ planId: id, mode: 'automatic' }))).status).toBe(400);
    expect(fake.write).not.toHaveBeenCalled();
  });
  it('saves edit text and explicit statements without accepting private-detail fields', async () => {
    await edit(
      request({
        draftId: id,
        text: 'Hello {{you:name}}. TX99887766',
        userStatements: ['TX99887766'],
        name: 'PRIVATE NAME',
        contact: 'PRIVATE PHONE',
      }),
    );
    expect(fake.edit).toHaveBeenCalledWith(
      fake.store,
      { draftId: id, text: 'Hello {{you:name}}. TX99887766', userStatements: ['TX99887766'] },
      expect.any(String),
    );
    expect(fake.generate).not.toHaveBeenCalled();
  });
});
