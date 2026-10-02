// Runs the real migration against an in-process Postgres (PGlite) and checks the security rules
// it promises: users only see their own rows, the activity log is append-only, guidance and usage
// counters cannot be written through the API, and evidence files are private to their owner.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const stubs = readFileSync(path.join(here, 'supabase-stubs.sql'), 'utf8');
const migration = readFileSync(path.join(here, '..', '..', 'supabase', 'migrations', '0001_init.sql'), 'utf8');
const readingMigration = readFileSync(path.join(here, '..', '..', 'supabase', 'migrations', '0002_agent_reading.sql'), 'utf8');
const quotaMigration = readFileSync(path.join(here, '..', '..', 'supabase', 'migrations', '0003_development_quota.sql'), 'utf8');
const investigationMigration = readFileSync(path.join(here, '..', '..', 'supabase', 'migrations', '0004_agent_investigation.sql'), 'utf8');
const modelMigration = readFileSync(path.join(here, '..', '..', 'supabase', 'migrations', '0005_model_availability.sql'), 'utf8');
const logicalCapsMigration = readFileSync(path.join(here, '..', '..', 'supabase', 'migrations', '0006_logical_call_caps.sql'), 'utf8');
const planReviewMigration = readFileSync(path.join(here, '..', '..', 'supabase', 'migrations', '0007_plan_review.sql'), 'utf8');

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

let db: PGlite;

/** Runs `work` the way the API would for a signed-in user: role `authenticated` plus JWT claims. */
async function asUser<T>(userId: string, work: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claims', '{"sub":"${userId}"}', false); set role authenticated;`);
  try {
    return await work();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}

/** Runs `work` as a visitor who has not signed in. */
async function asVisitor<T>(work: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claims', '', false); set role anon;`);
  try {
    return await work();
  } finally {
    await db.exec('reset role;');
  }
}

async function createCase(userId: string, title: string): Promise<string> {
  return asUser(userId, async () => {
    const result = await db.query<{ id: string }>('insert into public.cases (title) values ($1) returning id', [title]);
    return result.rows[0]!.id;
  });
}

async function addDocument(caseId: string, label: string, userIdForPath: string): Promise<void> {
  await db.query(
    `insert into public.documents (case_id, label, file_name, storage_path, mime_type, size_bytes)
     values ($1, $2, 'invoice.pdf', $3, 'application/pdf', 1000)`,
    [caseId, label, `${userIdForPath}/${caseId}/${label}.pdf`],
  );
}

beforeAll(async () => {
  db = await PGlite.create({extensions:{pgcrypto}});
  await db.exec(stubs);
  await db.exec(migration);
  await db.exec(readingMigration);
  await db.exec(quotaMigration);
  await db.exec(investigationMigration);
  await db.exec(modelMigration);
  await db.exec(logicalCapsMigration);
  await db.exec(planReviewMigration);
  await db.query('insert into auth.users (id) values ($1), ($2)', [ALICE, BOB]);
  await db.exec(`
    insert into public.guidance (id, title, body, source_name, source_url, checked_on)
    values ('test-snippet', 'Grievance officer timelines', 'Acknowledge within 48 hours.',
            'Test source', 'https://example.org/rule', '2026-10-01');
  `);
});

describe('cases', () => {
  it('installs daily app caps below the owner-reported primary quota', async () => {
    const limits = await db.query<{ value: unknown }>("select value from public.app_settings where key = 'limits'");
    expect(limits.rows[0]?.value).toMatchObject({ per_user_daily_model_calls: 15, global_daily_model_calls: 15 });
  });

  it('lets a user create and read their own case, with user_id filled in', async () => {
    const caseId = await createCase(ALICE, 'Alice refund');
    const rows = await asUser(ALICE, () => db.query<{ id: string; user_id: string }>('select id, user_id from public.cases'));
    expect(rows.rows).toContainEqual({ id: caseId, user_id: ALICE });
  });

  it("hides one user's cases from another user", async () => {
    await createCase(ALICE, 'Private to Alice');
    const rows = await asUser(BOB, () => db.query('select id from public.cases'));
    expect(rows.rows).toHaveLength(0);
  });

  it("does not let a user change or delete someone else's case", async () => {
    const caseId = await createCase(ALICE, 'Do not touch');
    const updated = await asUser(BOB, () => db.query(`update public.cases set title = 'hacked' where id = $1`, [caseId]));
    const deleted = await asUser(BOB, () => db.query('delete from public.cases where id = $1', [caseId]));
    expect(updated.affectedRows).toBe(0);
    expect(deleted.affectedRows).toBe(0);

    const check = await db.query<{ title: string }>('select title from public.cases where id = $1', [caseId]);
    expect(check.rows[0]?.title).toBe('Do not touch');
  });

  it('does not let a user create a case in another user’s name', async () => {
    await expect(
      asUser(BOB, () => db.query('insert into public.cases (user_id, title) values ($1, $2)', [ALICE, 'forged'])),
    ).rejects.toThrow(/row-level security/);
  });

  it('gives a visitor who has not signed in nothing at all', async () => {
    await expect(asVisitor(() => db.query('select id from public.cases'))).rejects.toThrow(/permission denied/);
  });
});

describe('signed model availability', () => {
  const secret='test-signing-secret-at-least-thirty-two-characters';
  it('denies direct client mutation, secret reads and visitor access', async () => {
    await db.query("insert into public.app_settings(key,value) values ('model_cooldown_signing',$1)",[JSON.stringify({secret})]);
    await expect(asUser(ALICE,()=>db.exec("insert into public.model_availability values('google:test',now()+interval '1 hour','quota',now())"))).rejects.toThrow();
    await expect(asUser(ALICE,()=>db.exec('select * from public.app_settings'))).rejects.toThrow();
    await expect(asVisitor(()=>db.exec('select * from public.model_availability'))).rejects.toThrow();
  });
  it('accepts a signed server receipt and rejects tampering and stale signatures', async () => {
    const issued=Date.now(),until=issued+60000,key='google:gemini-3.6-flash',reason='rate_limit';
    const signature=createHmac('sha256',secret).update(`v1\n${key}\n${until}\n${reason}\n${issued}`).digest('hex');
    const call=(end:number,stamp:number,sig:string)=>asUser(ALICE,()=>db.query('select public.record_model_cooldown($1,$2,$3,$4,$5)',[key,end,reason,stamp,sig]));
    await call(until,issued,signature);
    await expect(call(until+1000,issued,signature)).rejects.toThrow('signature');
    await expect(call(until,issued-120000,signature)).rejects.toThrow('receipt');
    await expect(asVisitor(()=>db.query('select public.record_model_cooldown($1,$2,$3,$4,$5)',[key,until,reason,issued,signature]))).rejects.toThrow();
    const rows=await asUser(BOB,()=>db.query<{usable_after:string}>('select usable_after from public.model_availability where model_key=$1',[key]));
    expect(new Date(rows.rows[0]!.usable_after).getTime()).toBe(until);
    await expect(asUser(ALICE,()=>db.exec('update public.model_availability set usable_after=now()'))).rejects.toThrow();
    await expect(asUser(ALICE,()=>db.exec('delete from public.model_availability'))).rejects.toThrow();
  });
});

describe('child tables', () => {
  it("does not let a user attach rows to someone else's case", async () => {
    const aliceCase = await createCase(ALICE, 'Target case');
    await expect(asUser(BOB, () => addDocument(aliceCase, 'E01', BOB))).rejects.toThrow(/row-level security/);
  });

  it('caps the number of documents in a case', async () => {
    const caseId = await createCase(ALICE, 'Many documents');
    await asUser(ALICE, async () => {
      for (let i = 1; i <= 10; i += 1) {
        await addDocument(caseId, `E${String(i).padStart(2, '0')}`, ALICE);
      }
    });
    await expect(asUser(ALICE, () => addDocument(caseId, 'E11', ALICE))).rejects.toThrow(/at most 10 documents/);
  });

  it('keeps the activity log append-only for the API', async () => {
    const caseId = await createCase(ALICE, 'Logged case');
    const eventId = await asUser(ALICE, async () => {
      const run = await db.query<{ id: string }>('insert into public.agent_runs (case_id) values ($1) returning id', [caseId]);
      const event = await db.query<{ id: string }>(
        `insert into public.agent_events (run_id, case_id, seq, type) values ($1, $2, 0, 'tool_call') returning id`,
        [run.rows[0]!.id, caseId],
      );
      return event.rows[0]!.id;
    });

    await expect(
      asUser(ALICE, () => db.query(`update public.agent_events set type = 'edited' where id = $1`, [eventId])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(ALICE, () => db.query('delete from public.agent_events where id = $1', [eventId])),
    ).rejects.toThrow(/permission denied/);
  });

  it('removes everything that belongs to a case when the owner deletes it', async () => {
    const caseId = await createCase(ALICE, 'To be deleted');
    await asUser(ALICE, async () => {
      await addDocument(caseId, 'E01', ALICE);
      const run = await db.query<{ id: string }>('insert into public.agent_runs (case_id) values ($1) returning id', [caseId]);
      await db.query(`insert into public.agent_events (run_id, case_id, seq, type) values ($1, $2, 0, 'tool_call')`, [
        run.rows[0]!.id,
        caseId,
      ]);
      await db.query(`insert into public.case_facts (case_id, field, status) values ($1, 'order_id', 'missing')`, [caseId]);
      await db.query('delete from public.cases where id = $1', [caseId]);
    });

    for (const table of ['documents', 'agent_runs', 'agent_events', 'case_facts']) {
      const left = await db.query<{ n: number }>(`select count(*)::int as n from public.${table} where case_id = $1`, [caseId]);
      expect(left.rows[0]?.n, table).toBe(0);
    }
  });
});

describe('guidance', () => {
  it('can be read by signed-in users and searched as text', async () => {
    const rows = await asUser(ALICE, () =>
      db.query<{ id: string }>(`select id from public.guidance where fts @@ websearch_to_tsquery('english', 'acknowledge 48 hours')`),
    );
    expect(rows.rows).toEqual([{ id: 'test-snippet' }]);
  });

  it('cannot be written through the API', async () => {
    await expect(
      asUser(ALICE, () =>
        db.query(
          `insert into public.guidance (id, title, body, source_name, source_url, checked_on)
           values ('fake', 'Fake rule', 'You are owed double.', 'Nobody', 'https://example.org', '2026-10-01')`,
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('model usage limits', () => {
  it('counts calls, then refuses at the per-user limit and at the global limit', async () => {
    await db.exec(`
      update public.app_settings
         set value = '{"per_user_daily_model_calls": 2, "global_daily_model_calls": 3}'
       where key = 'limits';
      delete from public.model_usage;
      delete from public.model_usage_global;
    `);
    const charge = (userId: string) =>
      asUser(userId, async () => {
        const result = await db.query<{ outcome: { allowed: boolean; reason: string | null; user_calls: number } }>(
          'select public.charge_model_call() as outcome',
        );
        return result.rows[0]!.outcome;
      });

    expect(await charge(ALICE)).toMatchObject({ allowed: true, user_calls: 1 });
    expect(await charge(ALICE)).toMatchObject({ allowed: true, user_calls: 2 });
    expect(await charge(ALICE)).toMatchObject({ allowed: false, reason: 'user_limit' });
    expect(await charge(BOB)).toMatchObject({ allowed: true, user_calls: 1 });
    expect(await charge(BOB)).toMatchObject({ allowed: false, reason: 'global_limit' });

    const total = await db.query<{ calls: number }>('select calls from public.model_usage_global');
    expect(total.rows[0]?.calls).toBe(3);
  });

  it('does not let a user reset their counter or read the limits', async () => {
    await expect(asUser(ALICE, () => db.query('update public.model_usage set calls = 0'))).rejects.toThrow(/permission denied/);
    await expect(asUser(ALICE, () => db.query('select * from public.app_settings'))).rejects.toThrow(/permission denied/);
    await expect(asUser(ALICE, () => db.query('select * from public.model_usage_global'))).rejects.toThrow(/permission denied/);
  });

  it('refuses a visitor who has not signed in', async () => {
    await expect(asVisitor(() => db.query('select public.charge_model_call()'))).rejects.toThrow(/permission denied/);
  });
});

describe('evidence files', () => {
  it('lets a user store files only under their own folder', async () => {
    await asUser(ALICE, () =>
      db.query(`insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [`${ALICE}/case-1/E01.pdf`]),
    );
    await expect(
      asUser(BOB, () => db.query(`insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [`${ALICE}/case-1/E02.pdf`])),
    ).rejects.toThrow(/row-level security/);
  });

  it("hides one user's files from another user", async () => {
    const mine = await asUser(ALICE, () => db.query('select name from storage.objects'));
    const theirs = await asUser(BOB, () => db.query('select name from storage.objects'));
    expect(mine.rows.length).toBeGreaterThan(0);
    expect(theirs.rows).toHaveLength(0);
  });
});

describe('agent reading transactions', () => {
  let caseId: string;
  let runId: string;
  const token = '33333333-3333-4333-8333-333333333333';
  const otherToken = '44444444-4444-4444-8444-444444444444';

  beforeAll(async () => {
    caseId = await createCase(ALICE, 'Reading transaction tests');
    await asUser(ALICE, () => addDocument(caseId, 'E01', ALICE));
    const run = await asUser(ALICE, () => db.query<{ id: string }>('insert into public.agent_runs (case_id) values ($1) returning id', [caseId]));
    runId = run.rows[0]!.id;
  });

  const claim = (user: string, turn: number, claimToken = token) => asUser(user, async () => {
    const result = await db.query<{ claimed: unknown }>('select public.claim_agent_turn($1, $2, $3) as claimed', [runId, turn, claimToken]);
    return result.rows[0]!.claimed;
  });

  it('lets only the owner claim a current turn, and excludes a second claimant', async () => {
    expect(await claim(BOB, 0)).toBeNull();
    expect(await claim(ALICE, 99)).toBeNull();
    expect(await claim(ALICE, 0)).toMatchObject({ id: runId, turn: 0, processing_token: token });
    expect(await claim(ALICE, 0, otherToken)).toBeNull();
  });

  it('releases a claim without moving the turn; another token cannot release it', async () => {
    await asUser(ALICE, () => db.query('select public.release_agent_turn($1, $2, $3)', [runId, 0, otherToken]));
    expect(await claim(ALICE, 0, otherToken)).toBeNull();
    await asUser(ALICE, () => db.query('select public.release_agent_turn($1, $2, $3)', [runId, 0, token]));
    expect(await claim(ALICE, 0)).toMatchObject({ turn: 0 });
  });

  it('commits facts, the document, the event and the turn together, and refuses a replay', async () => {
    const doc = await db.query<{ id: string }>('select id from public.documents where case_id = $1', [caseId]);
    const result = { doc_type: 'invoice', readable: true, facts: [{ field: 'order_id', value_text: 'MM-123456', quote: 'Order MM-123456', page: 1 }] };
    const finish = (user: string, claimToken: string) => asUser(user, async () => {
      const rows = await db.query<{ finished: unknown }>(
        `select public.finish_agent_reading($1, 0, $2, $3, $4::jsonb, 'read', '{}'::jsonb, $5::jsonb, 'fake-model') as finished`,
        [runId, claimToken, doc.rows[0]!.id, JSON.stringify(result), JSON.stringify({ type: 'tool_result', payload: { tool: 'read_document', label: 'E01' } })],
      );
      return rows.rows[0]!.finished;
    });
    expect(await finish(BOB, token)).toBeNull();
    expect(await finish(ALICE, otherToken)).toBeNull();
    expect(await finish(ALICE, token)).toMatchObject({ run: { turn: 1, processing_token: null }, events: [{ type: 'tool_result' }] });
    expect(await finish(ALICE, token)).toBeNull();
    const evidence = await db.query<{ n: number }>('select count(*)::int as n from public.evidence_items where case_id = $1', [caseId]);
    expect(evidence.rows[0]!.n).toBe(1);
    const documents = await db.query<{ read_status: string }>('select read_status from public.documents where case_id = $1', [caseId]);
    expect(documents.rows[0]!.read_status).toBe('read');
  });

  it('allows one active run per case', async () => {
    await expect(asUser(ALICE, () => db.query('insert into public.agent_runs (case_id) values ($1)', [caseId]))).rejects.toThrow(/duplicate key/);
  });

  it('refuses visitors and allows recovery of an expired claim', async () => {
    await expect(asVisitor(() => db.query('select public.claim_agent_turn($1, 1, $2)', [runId, token]))).rejects.toThrow(/permission denied/);
    expect(await claim(ALICE, 1)).toMatchObject({ turn: 1 });
    await db.query("update public.agent_runs set processing_started_at = now() - interval '3 minutes' where id = $1", [runId]);
    expect(await claim(ALICE, 1, otherToken)).toMatchObject({ processing_token: otherToken });
  });
});

describe('agent investigation transactions', () => {
  let caseId: string; let runId: string; let evidenceId: string;
  const token = '55555555-5555-4555-8555-555555555555';
  const questionId = '66666666-6666-4666-8666-666666666666';
  beforeAll(async () => {
    caseId = await createCase(ALICE, 'Investigation transaction');
    await asUser(ALICE, () => addDocument(caseId, 'E01', ALICE));
    const added = await asUser(ALICE, () => db.query<{ id: string }>("insert into public.evidence_items (case_id, source, document_id, field, value_text, quote, page) select $1, 'document', id, 'refund_amount', 'Rs 9999', 'Refund Rs 9999', 1 from public.documents where case_id = $1 returning id", [caseId]));
    evidenceId = added.rows[0]!.id;
    const run = await asUser(ALICE, () => db.query<{ id: string }>("insert into public.agent_runs(case_id, phase) values($1, 'investigating') returning id", [caseId]));
    runId = run.rows[0]!.id;
  });
  const claim = (turn: number) => asUser(ALICE, () => db.query<{ claim_agent_turn: unknown }>('select public.claim_agent_turn($1,$2,$3)', [runId, turn, token]));
  const finish = (user: string, turn: number, changes: unknown) => asUser(user, async () => {
    const result = await db.query<{ result: unknown }>('select public.finish_agent_step($1,$2,$3,$4::jsonb) as result', [runId, turn, token, JSON.stringify(changes)]);
    return result.rows[0]!.result;
  });
  it('atomically saves checked evidence, the fact sheet and two events, with an exclusive turn', async () => {
    await claim(0);
    const changes = { state: { quotes_checked: true }, evidence: [{ id: evidenceId, quote_verified: true, value_norm: { kind: 'amount', currency: 'INR', decimal: '9999.00' } }],
      facts: [{ field: 'refund_amount', status: 'document', value_text: 'Rs 9999', value_norm: { kind: 'amount', currency: 'INR', decimal: '9999.00' }, evidence_item_id: evidenceId, confirmed_by_user: false }],
      events: [{ type: 'tool_call', payload: { tool: 'check_quotes' } }, { type: 'tool_result', payload: { message: 'Checked quotes.' } }] };
    expect(await finish(BOB, 0, changes)).toBeNull();
    expect(await finish(ALICE, 0, changes)).toMatchObject({ run: { turn: 1, agent_state: { quotes_checked: true } }, events: [{ seq: 0 }, { seq: 1 }] });
    expect(await finish(ALICE, 0, changes)).toBeNull();
    const facts = await asUser(ALICE, () => db.query('select status from public.case_facts where case_id=$1', [caseId]));
    expect(facts.rows).toEqual([{ status: 'document' }]);
  });
  it('rolls everything back if a mutation points outside the run case', async () => {
    await claim(1);
    await expect(finish(ALICE, 1, { evidence: [{ id: '99999999-9999-4999-8999-999999999999', quote_verified: true }], events: [{ type: 'decision', payload: {} }] })).rejects.toThrow(/Evidence/);
    const run = await db.query<{ turn: number }>('select turn from public.agent_runs where id=$1', [runId]);
    expect(run.rows[0]?.turn).toBe(1);
  });
  it('creates a question and pauses; only an answered question allows a resume claim', async () => {
    const question = { id: questionId, kind: 'conflict', field: 'refund_amount', prompt: 'Which amount is right?', options: [{ id: 'one', label: '9999' }] };
    expect(await finish(ALICE, 1, { status: 'waiting_for_user', question, count_step: true, events: [{ type: 'question', payload: { message: 'Asked you which amount is right.' } }] })).toMatchObject({ run: { turn: 2, status: 'waiting_for_user', agent_steps: 1 }, question: { id: questionId } });
    const waiting = await claim(2); expect(waiting.rows[0]).toMatchObject({ claim_agent_turn: null });
    await asUser(ALICE, () => db.query("update public.questions set answer='\"9999\"'::jsonb, answered_at=now() where id=$1", [questionId]));
    const resumed = await claim(2); expect(resumed.rows[0]?.['claim_agent_turn']).toMatchObject({ processing_token: token });
    expect(await finish(ALICE, 2, { status: 'running', statement: { field: 'refund_amount', value_text: '9999' }, events: [{ type: 'answer', payload: {} }] })).toMatchObject({ run: { turn: 3, status: 'running' } });
  });
  it('refuses visitors and never adds an approved plan from a model step', async () => {
    await expect(asVisitor(() => db.query("select public.finish_agent_step($1,3,$2,'{}'::jsonb)", [runId, token]))).rejects.toThrow(/permission denied/);
    await claim(3);
    expect(await finish(ALICE, 3, { status: 'plan_ready', plan: { ladder_step: 1, summary: 'Ask for the refund.', reasons: [], dates: {}, guidance_ids: ['test-snippet'] }, events: [{ type: 'decision', payload: {} }] })).toMatchObject({ run: { turn: 4, status: 'plan_ready' }, plan: { approved_at: null } });
  });
});

describe('atomic plan review as the caller', () => {
  let caseId: string;
  beforeAll(async () => { caseId=await createCase(ALICE,'Plan review fixture'); });
  async function pending(step=1) {
    await asUser(ALICE,()=>db.query("update public.agent_runs set status='completed',phase='done' where case_id=$1",[caseId]));
    return asUser(ALICE,async()=> {
      const run=await db.query<{id:string}>("insert into public.agent_runs(case_id,phase,status) values($1,'investigating','plan_ready') returning id",[caseId]);
      const plan=await db.query<{id:string}>("insert into public.plans(case_id,run_id,ladder_step,guidance_ids) values($1,$2,$3,array['test-snippet']) returning id",[caseId,run.rows[0]!.id,step]);
      return {plan:plan.rows[0]!.id,run:run.rows[0]!.id};
    });
  }
  const review=(user:string,id:string,action:string)=>asUser(user,()=>db.query<{result:Record<string,unknown>|null}>('select public.review_plan($1,$2) as result',[id,action]));
  it('refuses visitors and hides another caller\'s plan',async()=> {
    const p=await pending();
    await expect(asVisitor(()=>db.query('select public.review_plan($1,$2)',[p.plan,'approve']))).rejects.toThrow(/permission denied/);
    expect((await review(BOB,p.plan,'approve')).rows[0]?.result).toBeNull();
    const unchanged=await db.query('select approved_at,rejected_at from public.plans where id=$1',[p.plan]);
    expect(unchanged.rows).toEqual([{approved_at:null,rejected_at:null}]);
  });
  it('approves once, updates the case and stops investigation without creating a draft',async()=> {
    const p=await pending();
    expect((await review(ALICE,p.plan,'approve')).rows[0]?.result).toMatchObject({plan:{id:p.plan,approved_at:expect.any(String)},run:{status:'completed',phase:'done'}});
    await review(ALICE,p.plan,'approve');
    const cases=await db.query('select status,ladder_step from public.cases where id=$1',[caseId]);
    expect(cases.rows).toEqual([{status:'approved',ladder_step:1}]);
    const events=await db.query('select payload from public.agent_events where run_id=$1',[p.run]);
    expect(events.rows).toHaveLength(1);
    const drafts=await db.query('select id from public.drafts where plan_id=$1',[p.plan]); expect(drafts.rows).toHaveLength(0);
  });
  it('archives a changed plan and creates one saved free-text question',async()=> {
    const p=await pending();
    expect((await review(ALICE,p.plan,'change')).rows[0]?.result).toMatchObject({plan:{rejected_at:expect.any(String)},run:{status:'waiting_for_user'},question:{field:null,options:[],answer:null}});
    expect((await review(ALICE,p.plan,'change')).rows[0]?.result).toBeNull();
    const questions=await db.query('select id from public.questions where run_id=$1',[p.run]);expect(questions.rows).toHaveLength(1);
    const run=await db.query<{agent_state:unknown}>('select agent_state from public.agent_runs where id=$1',[p.run]);expect(run.rows[0]?.agent_state).not.toHaveProperty('next_step');
  });
  it('rejects without approval or further investigation, and never approves step three',async()=> {
    const p=await pending(0);
    expect((await review(ALICE,p.plan,'reject')).rows[0]?.result).toMatchObject({plan:{approved_at:null,rejected_at:expect.any(String)},run:{status:'completed'}});
    const info=await pending(3);
    await expect(review(ALICE,info.plan,'approve')).rejects.toThrow(/information only/i);
  });
  it('does not approve a plan after its facts have changed',async()=> {
    const p=await pending();
    await asUser(ALICE,()=>db.query("insert into public.case_facts(case_id,field,status,value_text) values($1,'refund_amount','user','1000')",[caseId]));
    await expect(review(ALICE,p.plan,'approve')).rejects.toThrow(/facts have changed/i);
    const plan=await db.query('select approved_at from public.plans where id=$1',[p.plan]);expect(plan.rows[0]).toEqual({approved_at:null});
  });
  it('accepts a waiting plan without adding any draft',async()=> {
    const p=await pending(0);
    expect((await review(ALICE,p.plan,'approve')).rows[0]?.result).toMatchObject({plan:{ladder_step:0,approved_at:expect.any(String)}});
    expect((await db.query('select id from public.drafts where plan_id=$1',[p.plan])).rows).toHaveLength(0);
  });
  it('refuses approval if a cited rule is missing',async()=> {
    const p=await pending();
    await asUser(ALICE,()=>db.query("update public.plans set guidance_ids=array['missing-rule'] where id=$1",[p.plan]));
    await expect(review(ALICE,p.plan,'approve')).rejects.toThrow(/Checked guidance/);
  });
});

describe('owner-checked guidance seed',()=> {
  it('runs and reruns the exact dashboard seed, retaining the six confirmed bodies and dates',async()=> {
    const seed=readFileSync(path.join(here,'..','..','supabase','seed.sql'),'utf8');
    const data=JSON.parse(readFileSync(path.join(here,'..','..','supabase','guidance-drafts.json'),'utf8')) as {status:string;checked_on:string;rows:Array<Record<string,unknown>>};
    expect(data.status).toBe('HUMAN CHECKED'); expect(data.checked_on).toBe('2026-10-02');
    await db.exec(seed); await db.exec(seed);
    const result=await asUser(ALICE,()=>db.query("select id,title,body,source_name,source_url,checked_on::text,applies_to_steps from public.guidance where id<>'test-snippet' order by id"));
    expect(result.rows).toEqual([...data.rows].sort((a,b)=>String(a['id']).localeCompare(String(b['id']))));
    expect(result.rows).toHaveLength(6);
  });
});

// Keep this last: it fills Bob's allowance of cases.
describe('abuse bounds', () => {
  it('caps the number of cases one user can keep', async () => {
    for (let i = 1; i <= 10; i += 1) {
      await createCase(BOB, `Case ${i}`);
    }
    await expect(createCase(BOB, 'One too many')).rejects.toThrow(/at most 10 cases/);
  });
});
