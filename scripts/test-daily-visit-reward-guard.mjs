import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const member = 'fa6f3481-41d9-479e-a60a-7f58525021e8';
const insert = (reason, amount, time) => db.query(`INSERT INTO haifn_transactions
    (user_id,amount,source_description,created_at) VALUES($1,$2,$3,$4)`, [member, amount, reason, time]);
try {
    await db.exec(`CREATE TABLE users(id uuid PRIMARY KEY,current_haifn integer DEFAULT 0);
        CREATE TABLE haifn_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,
        amount integer,transaction_type text,source_description text,source_id text,created_at timestamptz DEFAULT now());
        CREATE FUNCTION balance_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        UPDATE users SET current_haifn=current_haifn+NEW.amount WHERE id=NEW.user_id; RETURN NEW; END $$;
        CREATE TRIGGER balance_update AFTER INSERT ON haifn_transactions FOR EACH ROW EXECUTE FUNCTION balance_update();
        INSERT INTO users(id) VALUES('${member}');`);
    await db.exec(await readFile('supabase/migrations/20261016010000_guard_daily_visit_rewards.sql', 'utf8'));
    const base = '공간 방문 (1일 1회)';
    const auto = '[자동 정산] 공간 방문 (2026-07-29)';
    await insert(base, 1, '2026-07-28T15:00:00Z');
    await assert.rejects(insert(base, 1, '2026-07-29T14:59:59Z'), e => e.code === '23505');
    await assert.rejects(insert(auto, 1, '2026-08-28T03:00:00Z'), e => e.code === '23505');
    await insert(base, 1, '2026-07-29T15:00:00Z'); // next KST day
    await insert(auto, -1, '2026-08-28T03:00:00Z');
    await insert(auto, 1, '2026-08-28T03:01:00Z'); // valid re-settlement
    await assert.rejects(insert(auto, 1, '2026-08-28T03:02:00Z'), e => e.code === '23505');
    await insert('공간 체류 (1시간 이상)', 1, '2026-07-29T04:00:00Z');
    await insert('[프로그램 참여] test', 5, '2026-07-29T04:00:00Z');
    assert.equal((await db.query('SELECT current_haifn FROM users')).rows[0].current_haifn, 8);

    // Historical duplicates remain intact; the reviewed correction is additive
    // and idempotent, and the existing balance trigger performs the debit.
    await db.exec('DROP TRIGGER guard_daily_visit_reward ON haifn_transactions; TRUNCATE haifn_transactions, users;');
    const targets = [
        ['b493c70a-6cb1-49c5-9591-1d75941e65d5','2026-06-25',1],
        ['807540b2-5f04-4f5d-9d8e-ca42769c4021','2026-06-26',2],
        ['44bf179e-6c6d-4c44-b800-8aa6e72cdf47','2026-06-26',2],
        [member,'2026-07-29',1],
        ['ac14eaa0-e4d5-452d-9858-bd00693ce69b','2026-07-29',1],
        ['5adf41e6-e3fd-4e2a-b789-5e04ff992d97','2026-09-18',1],
    ];
    for (const [id, date, extra] of targets) {
        await db.query('INSERT INTO users(id) VALUES($1)', [id]);
        for (let i=0; i<=extra; i++) await db.query(`INSERT INTO haifn_transactions
            (user_id,amount,source_description,created_at) VALUES($1,1,$2,$3)`, [id,base,`${date}T12:00:00+09:00`]);
    }
    await db.exec(await readFile('supabase/migrations/20261016010000_guard_daily_visit_rewards.sql', 'utf8'));
    const correction = await readFile('supabase/manual/proposals/20261016_correct_duplicate_visit_rewards.sql', 'utf8');
    await db.exec(correction);
    await db.exec(correction);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM haifn_transactions WHERE amount>0')).rows[0].n,14);
    assert.equal((await db.query('SELECT sum(amount)::int AS n FROM haifn_transactions WHERE amount<0')).rows[0].n,-8);
    assert.deepEqual((await db.query('SELECT current_haifn FROM users')).rows.map(r=>r.current_haifn),[1,1,1,1,1,1]);
    console.log('PASS KST midnight, repeated awards, backdated settlement, reversal/re-award, unrelated rewards, preserved originals, exact -8H and idempotent correction');
} finally { await db.close(); }
