import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {connectCommunityDb,communityProject} from './community-db.mjs';
const migration=await readFile('supabase/migrations/20261028020000_challenge_success_message_receipts.sql','utf8');
const db=await connectCommunityDb();
const begin=async(readonly=false)=>{await db.query(readonly?'BEGIN READ ONLY':'BEGIN');await db.query('SET LOCAL ROLE postgres');};
const counts=async()=>(await db.query(`SELECT
 (SELECT count(*)::int FROM notices) notices,
 (SELECT count(*)::int FROM online_challenge_submissions) online_submissions,
 (SELECT count(*)::int FROM offline_challenge_submissions) offline_submissions,
 (SELECT count(*)::int FROM haifn_transactions) transactions,
 (SELECT count(*)::int FROM challenge_completion_rewards) rewards`)).rows[0];
try{
    await begin(true);
    const {rows:[exists]}=await db.query("SELECT to_regclass('public.challenge_success_message_receipts') AS name");
    if(exists.name){await db.query('ROLLBACK');console.log('Receipt table already exists; no changes applied.');}
    else{
        const before=await counts();await db.query('ROLLBACK');
        await mkdir('artifacts/challenge-success-receipts',{recursive:true});
        await writeFile('artifacts/challenge-success-receipts/before.json',JSON.stringify({project:communityProject,before,newTable:true},null,2));
        await writeFile('artifacts/challenge-success-receipts/disable-access.sql','-- Recovery: first restore previous frontend, then disable receipt access without deleting records.\nREVOKE SELECT, INSERT ON public.challenge_success_message_receipts FROM anon, authenticated;\n');
        if(process.argv.includes('--apply')){
            await begin();await db.query(migration);
            assert.deepEqual(await counts(),before,'Existing data must remain unchanged during dry run');
            assert.equal((await db.query('SELECT count(*)::int n FROM challenge_success_message_receipts')).rows[0].n,0);
            await db.query('ROLLBACK');
            await begin();await db.query(migration);
            const {rows:[policy]}=await db.query("SELECT relrowsecurity AS rls FROM pg_class WHERE oid='public.challenge_success_message_receipts'::regclass");
            assert.equal(policy.rls,true);
            await db.query('COMMIT');
            console.log('PASS receipt migration applied after rollback dry run; no existing records changed, no premarked students.');
        }else console.log('PASS read-only impact check. New table only; recovery plan saved.');
    }
}catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}finally{await db.end();}
