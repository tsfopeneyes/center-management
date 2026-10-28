import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const project = 'erecqalsxoxrufggvmcc';
assert.equal((await readFile('supabase/.temp/project-ref','utf8')).trim(), project);
const dir = 'artifacts/daily-visit-reward-20261016';
await mkdir(dir,{recursive:true});
const ids = ['b493c70a-6cb1-49c5-9591-1d75941e65d5','807540b2-5f04-4f5d-9d8e-ca42769c4021',
    '44bf179e-6c6d-4c44-b800-8aa6e72cdf47','fa6f3481-41d9-479e-a60a-7f58525021e8',
    'ac14eaa0-e4d5-452d-9858-bd00693ce69b','5adf41e6-e3fd-4e2a-b789-5e04ff992d97'];
const list = ids.map(id=>`'${id}'::uuid`).join(',');
const query = async (name, sql) => {
    const path = `${dir}/${name}.sql`;
    await writeFile(path, sql);
    const raw = execFileSync(process.env.ComSpec || 'cmd.exe', ['/d','/s','/c',
        `npx --yes supabase db query --project-ref ${project} --linked --file ${path} --output json`],
        {encoding:'utf8',maxBuffer:8_000_000,stdio:['ignore','pipe','pipe']});
    const result=JSON.parse(raw.slice(raw.indexOf('{')));
    await writeFile(`${dir}/${name}.json`,JSON.stringify(result,null,2));
    return result.rows;
};
const snapshot = await query('before',`BEGIN READ ONLY;
SELECT jsonb_build_object('project','${project}','as_of',now(),
 'users',(SELECT jsonb_agg(x) FROM (SELECT id,name,current_haifn FROM users WHERE id IN (${list}) ORDER BY id)x),
 'transactions',(SELECT jsonb_agg(t ORDER BY t.id) FROM haifn_transactions t WHERE user_id IN (${list}))) AS snapshot;
ROLLBACK;`);
assert.equal(snapshot[0].snapshot.users.length,6);
const migration=await readFile('supabase/migrations/20261016010000_guard_daily_visit_rewards.sql','utf8');
const correction=await readFile('supabase/manual/proposals/20261016_correct_duplicate_visit_rewards.sql','utf8');
const verification=`DO $$ BEGIN
 IF (SELECT count(*) FROM haifn_transactions WHERE source_id LIKE 'visit-duplicate-correction-20261016|%') <> 6
 OR (SELECT sum(amount) FROM haifn_transactions WHERE source_id LIKE 'visit-duplicate-correction-20261016|%') <> -8
 THEN RAISE EXCEPTION 'Unexpected correction scope'; END IF;
 -- No actual award should be added by this negative test.
 BEGIN
 INSERT INTO haifn_transactions(user_id,amount,transaction_type,source_description,created_at)
 VALUES('fa6f3481-41d9-479e-a60a-7f58525021e8',1,'EARN','공간 방문 (1일 1회)','2026-07-29T12:00:00+09:00');
 RAISE EXCEPTION 'Duplicate award was allowed';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
SELECT jsonb_build_object('corrections',(SELECT jsonb_agg(x) FROM
 (SELECT t.id,t.user_id,u.name,t.amount,t.source_description,t.source_id,u.current_haifn
 FROM haifn_transactions t JOIN users u ON u.id=t.user_id
 WHERE t.source_id LIKE 'visit-duplicate-correction-20261016|%' ORDER BY t.user_id)x),
 'originals',(SELECT jsonb_agg(t ORDER BY t.id) FROM haifn_transactions t WHERE user_id IN (${list})
 AND source_id IS DISTINCT FROM 'unused' AND coalesce(source_id,'') NOT LIKE 'visit-duplicate-correction-20261016|%')) AS result;`;
const runSql = end => `BEGIN; SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='60s';
LOCK TABLE public.haifn_transactions IN SHARE ROW EXCLUSIVE MODE;
${migration}\n${correction}\n${verification}\n${end};`;
const dry = await query('dry-run',runSql('ROLLBACK'));
const before = snapshot[0].snapshot;
function validate(rows) {
    const result=rows[0].result;
    assert.deepEqual(result.originals,before.transactions);
    assert.equal(result.corrections.length,6);
    assert.equal(result.corrections.reduce((n,r)=>n+r.amount,0),-8);
    for(const row of result.corrections) assert.equal(row.current_haifn,
        before.users.find(u=>u.id===row.user_id).current_haifn+row.amount);
}
validate(dry);
console.log('PASS production dry-run: original transactions preserved; 6 corrections, -8H; exact balance deltas; duplicate rejected; rolled back');
if(process.argv.includes('--apply')) {
    const after=await query('applied',runSql('COMMIT'));
    validate(after);
    console.log(JSON.stringify(after[0].result.corrections));
    console.log('PASS committed reviewed correction and daily guard');
}
