import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeDraft } from '../../server/draft/write-draft.js';
import type { DraftDependencies, DraftStore } from '../../server/draft/write-draft.js';
import type { PlanRow } from '../../shared/database.js';
import { context } from '../fixtures/draft.js';
describe('approval-gated idempotent drafting', () => {
  const generate = vi.fn();
  const save = vi.fn();
  const claim = vi.fn();
  const release = vi.fn();
  const existing = vi.fn();
  let plan: PlanRow;
  let store: DraftStore;
  let deps: DraftDependencies;
  beforeEach(() => {
    vi.resetAllMocks();
    plan = {
      id: 'plan',
      case_id: 'case',
      user_id: 'owner',
      run_id: 'run',
      ladder_step: 1,
      summary: 'Overdue refund.',
      reasons: [],
      dates: context.dates,
      guidance_ids: ['rule'],
      approved_at: '2026-10-02',
      rejected_at: null,
      sent_on: null,
      outcome: null,
      created_at: '2026-10-01',
      draft_claim_token: null,
      draft_claimed_at: null,
    };
    claim.mockResolvedValue({ ...plan, draft_claim_token: 'claim' });
    existing.mockResolvedValue(null);
    release.mockResolvedValue(undefined);
    save.mockResolvedValue({ id: 'draft', version: 1 });
    generate.mockResolvedValue({
      template: 'Please refund {{fact:refund_amount}} for {{fact:order_id}}.\n{{you:name}}',
      modelId: 'fake-model',
    });
    store = {
      getPlan: async () => plan,
      existing,
      claim,
      release,
      context: async () => ({ ...context, guidance: [] }),
      save,
    };
    deps = { generate, today: () => context.today };
  });
  it.each([null, 'rejected'])(
    'refuses an unapproved/rejected plan before a call or claim: %s',
    (rejected) => {
      plan.approved_at = null;
      plan.rejected_at = rejected;
      return expect(writeDraft(store, deps, 'plan'))
        .rejects.toMatchObject({ code: 'plan_not_approved' })
        .then(() => {
          expect(generate).not.toHaveBeenCalled();
          expect(claim).not.toHaveBeenCalled();
        });
    },
  );
  it.each([0, 3])('prepares nothing at information/wait step %s', (step) => {
    plan.ladder_step = step;
    return expect(writeDraft(store, deps, 'plan'))
      .rejects.toMatchObject({ code: 'no_complaint_needed' })
      .then(() => {
        expect(generate).not.toHaveBeenCalled();
      });
  });
  it('returns a saved draft without charging or generating again', async () => {
    existing.mockResolvedValue({ id: 'saved' });
    expect(await writeDraft(store, deps, 'plan')).toMatchObject({ id: 'saved' });
    expect(generate).not.toHaveBeenCalled();
  });
  it('saves a rendered template and actual answering model, with no personal details', async () => {
    await writeDraft(store, deps, 'plan');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ draft_claim_token: 'claim' }),
      expect.objectContaining({
        template_md: expect.stringContaining('{{fact:'),
        rendered_md: expect.stringContaining('₹9,999 [E02]'),
        modelId: 'fake-model',
      }),
    );
    expect(release).not.toHaveBeenCalled();
  });
  it('regenerates once for an unknown placeholder then fails plainly', async () => {
    generate.mockResolvedValue({ template: '{{fact:unknown}}', modelId: 'fake-model' });
    await expect(writeDraft(store, deps, 'plan')).rejects.toMatchObject({
      code: 'draft_template_invalid',
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(save).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('never saves a raw model-typed amount/date/ID even when it matches the sheet', async () => {
    generate.mockResolvedValueOnce({ template: 'Refund INR 9999.', modelId: 'first' });
    await writeDraft(store, deps, 'plan');
    expect(generate).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0]?.[1]).toMatchObject({
      modelId: 'fake-model',
      answeringModels: ['first', 'fake-model'],
    });
  });
  it('does not generate while another request holds the claim', async () => {
    claim.mockResolvedValue(null);
    await expect(writeDraft(store, deps, 'plan')).rejects.toMatchObject({
      code: 'draft_in_progress',
    });
    expect(generate).not.toHaveBeenCalled();
  });
  it('releases the claim on a refused charge or failed save without retrying the provider', async () => {
    generate.mockRejectedValue(new Error('Daily limit reached.'));
    await expect(writeDraft(store, deps, 'plan')).rejects.toThrow('Daily limit');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
