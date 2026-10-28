import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { build } from 'esbuild';
import vm from 'node:vm';

const db = new PGlite();
const a = crypto.randomUUID(), b = crypto.randomUUID();
try {
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;
      CREATE TABLE users(id uuid PRIMARY KEY);
      CREATE TABLE notices(id bigint PRIMARY KEY,is_challenge boolean);
      CREATE TABLE notice_responses(notice_id bigint,user_id uuid,status text);
      CREATE FUNCTION is_current_profile(uuid) RETURNS boolean LANGUAGE sql AS $$
        SELECT $1::text = current_setting('test.user',true) $$;
      GRANT SELECT ON notices,notice_responses TO anon,authenticated;
      INSERT INTO users VALUES('${a}'),('${b}');
      INSERT INTO notices VALUES(1,true),(2,true),(3,false);
      INSERT INTO notice_responses VALUES(1,'${a}','JOIN'),(1,'${b}','JOIN'),(3,'${a}','JOIN');`);
    await db.exec(await readFile('supabase/migrations/20261028020000_challenge_success_message_receipts.sql','utf8'));
    await db.exec('SET ROLE authenticated');
    await db.query("SELECT set_config('test.user',$1,false)",[a]);
    assert.equal((await db.query('SELECT count(*)::int n FROM challenge_success_message_receipts')).rows[0].n,0,'No existing success is premarked');
    await assert.rejects(db.query('INSERT INTO challenge_success_message_receipts(challenge_id,user_id) VALUES(1,$1)',[b]),/row-level security/);
    await assert.rejects(db.query('INSERT INTO challenge_success_message_receipts(challenge_id,user_id) VALUES(2,$1)',[a]),/row-level security/);
    await assert.rejects(db.query('INSERT INTO challenge_success_message_receipts(challenge_id,user_id) VALUES(3,$1)',[a]),/row-level security/);
    await db.query('INSERT INTO challenge_success_message_receipts(challenge_id,user_id) VALUES(1,$1)',[a]);
    await assert.rejects(db.query('INSERT INTO challenge_success_message_receipts(challenge_id,user_id) VALUES(1,$1)',[a]),/duplicate key/);
    await db.query("SELECT set_config('test.user',$1,false)",[b]);
    assert.equal((await db.query('SELECT count(*)::int n FROM challenge_success_message_receipts')).rows[0].n,0,'Other users cannot read receipt');
    await assert.rejects(db.query('DELETE FROM challenge_success_message_receipts'),/permission denied/);
    await db.exec('SET ROLE anon');
    await db.query("SELECT set_config('test.user',$1,false)",[b]);
    await db.query('INSERT INTO challenge_success_message_receipts(challenge_id,user_id) VALUES(1,$1)',[b]);
    await db.query("SELECT set_config('test.user','',false)");
    assert.equal((await db.query('SELECT count(*)::int n FROM challenge_success_message_receipts')).rows[0].n,0,'Anonymous visitors cannot see receipts');
} finally { await db.close(); }

const compiled = await build({entryPoints:['src/api/challengeSuccessApi.js'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{
    name:'mock-db',setup(build){
        build.onResolve({filter:/supabaseClient$/},()=>({path:'mock-db',namespace:'mock'}));
        build.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const supabase=globalThis.mockDb;'}));
    },
}]});
const records = new Set();
const createClient = () => {
    const storage = new Map();
    const module = {exports:{}};
    const mockDb = {from(table){
        assert.equal(table,'challenge_success_message_receipts');
        const filters={};
        const q={select(){return q;},eq(k,v){filters[k]=v;return q;},async maybeSingle(){return {data:records.has(`${filters.challenge_id}:${filters.user_id}`)?{shown_at:'now'}:null};},
            async insert(row){const key=`${row.challenge_id}:${row.user_id}`;if(records.has(key))return {error:{code:'23505'}};records.add(key);return {error:null};}};
        return q;
    }};
    vm.runInNewContext(compiled.outputFiles[0].text,{module,exports:module.exports,mockDb,console,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});
    return module.exports.challengeSuccessApi;
};
const first = createClient();
assert.equal(await first.hasShown(1,a),false,'Existing success is eligible on first entry');
await first.markShown(1,a);
assert.equal(await first.hasShown(1,a),true);
assert.equal(await createClient().hasShown(1,a),true,'Receipt persists across devices/browser storage');
assert.equal(await createClient().hasShown(2,a),false,'Per challenge isolation');
assert.equal(await createClient().hasShown(1,b),false,'Per student isolation');
await first.markShown(1,a);
assert.equal(records.size,1,'Repeated effects/manual replay cannot duplicate receipts');
console.log('PASS success receipts: first entry, durable per-account receipt, cross-device reads, idempotency, membership/owner isolation, no update/delete privileges.');
