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
  it('does not generate another grievance letter for a sent waiting plan, but restores its saved draft',async()=>{
    plan.sent_on='2026-10-01';
    await expect(writeDraft(store,deps,'plan')).rejects.toMatchObject({code:'no_complaint_needed'});
    expect(claim).not.toHaveBeenCalled();expect(generate).not.toHaveBeenCalled();
    const old={id:'original'};existing.mockResolvedValue(old);
    expect(await writeDraft(store,deps,'plan')).toEqual(old);
  });
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
    expect(generate.mock.calls[1]?.[3]).toEqual(['literal_value']);
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
  it('uses basic recovery without a provider and records its code origin', async () => {
    store.context = async () => ({ ...context, guidance: [], facts: [...context.facts,
      { field: 'merchant_name', status: 'user', value_text: 'Meridian Mart', value_norm: { kind: 'text', value: 'meridian mart' }, evidence_item_id: null },
      { field: 'refund_received', status: 'user', value_text: 'No', value_norm: { kind: 'boolean', value: false }, evidence_item_id: null },
    ] });
    plan.ladder_step = 2;
    claim.mockResolvedValue({ ...plan, draft_claim_token: 'claim' });
    await writeDraft(store, deps, 'plan', 'basic');
    expect(generate).not.toHaveBeenCalled();
    expect(save.mock.calls[0]?.[1]).toMatchObject({ modelId: null, generationKind:'code_basic', answeringModels: [], lint: { generationKind: 'code_basic', chronologyByCode: true } });
    expect(save.mock.calls[0]?.[1].rendered_md).toContain('Requested remedy');
  });
  it('releases a basic claim and gives an actionable error for absent facts', async () => {
    await expect(writeDraft(store, deps, 'plan', 'basic')).rejects.toMatchObject({ status: 409, code: 'basic_facts_unavailable' });
    expect(generate).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled(); expect(release).toHaveBeenCalledTimes(1);
  });
  it('logs only validation codes and model identity, never rejected document prose', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    generate.mockResolvedValue({ template: 'PRIVATE DOCUMENT 9999', modelId: 'fake-model' });
    try {
      await expect(writeDraft(store, deps, 'plan')).rejects.toMatchObject({ code: 'draft_template_invalid' });
      expect(JSON.stringify(warning.mock.calls)).not.toContain('PRIVATE DOCUMENT');
      expect(warning.mock.calls[0]?.[1]).toMatchObject({ issues: ['literal_value'] });
    } finally { warning.mockRestore(); }
  });
  it('releases the claim on a refused charge or failed save without retrying the provider', async () => {
    generate.mockRejectedValue(new Error('Daily limit reached.'));
    await expect(writeDraft(store, deps, 'plan')).rejects.toThrow('Daily limit');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
