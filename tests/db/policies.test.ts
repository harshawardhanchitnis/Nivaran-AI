// Runs the real migration against an in-process Postgres (PGlite) and checks the security rules
// it promises: users only see their own rows, the activity log is append-only, guidance and usage
// counters cannot be written through the API, and evidence files are private to their owner.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const stubs = readFileSync(path.join(here, 'supabase-stubs.sql'), 'utf8');
const migration = readFileSync(path.join(here, '..', '..', 'supabase', 'migrations', '0001_init.sql'), 'utf8');

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
  db = await PGlite.create();
  await db.exec(stubs);
  await db.exec(migration);
  await db.query('insert into auth.users (id) values ($1), ($2)', [ALICE, BOB]);
  await db.exec(`
    insert into public.guidance (id, title, body, source_name, source_url, checked_on)
    values ('test-snippet', 'Grievance officer timelines', 'Acknowledge within 48 hours.',
            'Test source', 'https://example.org/rule', '2026-10-01');
  `);
});

describe('cases', () => {
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

// Keep this last: it fills Bob's allowance of cases.
describe('abuse bounds', () => {
  it('caps the number of cases one user can keep', async () => {
    for (let i = 1; i <= 10; i += 1) {
      await createCase(BOB, `Case ${i}`);
    }
    await expect(createCase(BOB, 'One too many')).rejects.toThrow(/at most 10 cases/);
  });
});
