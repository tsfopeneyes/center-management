import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { getChallengeProgress } from '../src/utils/challengeProgress.js';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const compile = async (entry, customRequire = require) => {
    const result = await build({ entryPoints:[entry], bundle:true, write:false, format:'cjs', platform:'node', packages:'external' });
    const module = { exports:{} };
    vm.runInNewContext(result.outputFiles[0].text,{ module, exports:module.exports, require:customRequire, URL, Date, console });
    return module.exports;
};
const {prepareNoticeForEdit} = await compile('src/components/admin/board/utils/noticeHelpers.js');
const legacy = prepareNoticeForEdit({content:'',guest_properties:{challenge_reward_criterion:'FIRST_MISSION'},is_challenge:true});
assert.equal(legacy.challenge_reward_criterion,'COUNT');
assert.equal(legacy.challenge_reward_count,1,'Legacy first-mission setting reopens as one success');
const saved = prepareNoticeForEdit({content:'',guest_properties:{challenge_reward_criterion:'COUNT',challenge_reward_count:5},is_challenge:true});
assert.equal(saved.challenge_reward_count,5,'Editing preserves saved five-count threshold');
let hookState;
const hook = await compile('src/components/admin/board/hooks/useNoticeForm.js',name=>name==='react'?{
    useCallback:fn=>fn, useState:()=>[hookState,()=>{}],
}:require(name));
hookState={title:'Test',is_challenge:true,challenge_format:'ONLINE',challenge_reward_criterion:'COUNT',challenge_reward_count:8,challenge_missions:[{id:'m',schedule_type:'FLEXIBLE',target_count:7}]};
assert.equal(hook.default('NOTICE').validateForm().isValid,false,'Saving impossible threshold is blocked');
hookState={...hookState,challenge_reward_count:5};
assert.equal(hook.default('NOTICE').validateForm().isValid,true,'Five-of-seven threshold can be saved');

const db = new PGlite();
await db.exec(`CREATE TABLE notices(id bigint PRIMARY KEY,title text,is_challenge boolean,challenge_format text,
 program_start_date date,program_end_date date,program_status text,haifn_reward int,guest_properties jsonb);
CREATE TABLE online_challenge_missions(id uuid PRIMARY KEY,challenge_id bigint,schedule_type text,target_count int,is_active boolean);
CREATE TABLE offline_challenge_missions(LIKE online_challenge_missions INCLUDING ALL);
CREATE TABLE online_challenge_submissions(mission_id uuid,participant_id uuid,completion_date date,is_valid boolean);
CREATE TABLE offline_challenge_submissions(mission_id uuid,participant_id uuid,status text);
CREATE TABLE notice_responses(notice_id bigint,user_id uuid,status text);
CREATE TABLE challenge_completion_rewards(challenge_id bigint,participant_id uuid,transaction_id uuid,UNIQUE(challenge_id,participant_id));
CREATE TABLE haifn_transactions(id uuid DEFAULT gen_random_uuid(),user_id uuid,amount int,transaction_type text,source_description text,admin_id uuid);`);
await db.exec(await readFile('supabase/migrations/20261028010000_unify_challenge_success_criterion.sql','utf8'));
await db.exec('CREATE TRIGGER settle AFTER UPDATE ON notices FOR EACH ROW EXECUTE FUNCTION settle_challenge_rewards_on_close();');
let caseId = 0;
try {
    for (const c of [
        {type:'COUNT', count:5, done:4, success:false}, {type:'COUNT', count:5, done:5, success:true},
        {type:'COUNT', count:5, done:9, success:true}, {type:'COUNT', count:8, done:7, success:false},
        {type:'PERCENT', percent:70, done:4, success:false}, {type:'PERCENT', percent:70, done:5, success:true},
        {type:'ALL', done:5, success:false}, {type:'ALL', done:7, success:true},
        {type:'FIRST_MISSION', done:1, success:true}, {done:5, success:false},
        {type:'COUNT', count:5, done:5, invalid:1, success:false},
        {type:'COUNT', count:5, done:5, daily:true, repeatedDay:true, success:false},
        {type:'COUNT', count:5, done:5, daily:true, success:true},
        {type:'COUNT', count:5, done:5, offline:true, success:true},
        {type:'COUNT', count:5, done:4, offline:true, pending:true, success:false},
        {type:'FIRST_MISSION', done:0, empty:true, success:false},
    ]) {
        const n = ++caseId, user = crypto.randomUUID();
        const settings = { challenge_reward_criterion:c.type, challenge_reward_count:c.count, challenge_reward_percent:c.percent };
        const notice = { id:n, challenge_format:c.offline?'OFFLINE':'ONLINE', program_start_date:'2026-10-01', program_end_date:'2026-10-07', guest_properties:settings, challenge_missions:[] };
        await db.query("INSERT INTO notices VALUES($1,$2,true,$3,'2026-10-01','2026-10-07','ACTIVE',10,$4)",[n,'case '+n,notice.challenge_format,JSON.stringify(settings)]);
        await db.query("INSERT INTO notice_responses VALUES($1,$2,'JOIN')",[n,user]);
        const submissions=[];
        for(let m=0;m<(c.empty?0:c.offline?7:1);m++) {
            const mission={id:crypto.randomUUID(),schedule_type:c.daily?'DAILY':'FLEXIBLE',target_count:7,is_active:true};
            notice.challenge_missions.push(mission);
            await db.query(`INSERT INTO ${c.offline?'offline':'online'}_challenge_missions VALUES($1,$2,$3,7,true)`,[mission.id,n,mission.schedule_type]);
            if(c.offline) {
                if(m<c.done || c.pending&&m===c.done) {
                    const status=m<c.done?'COMPLETED':'PENDING';
                    submissions.push({mission_id:mission.id,status});
                    await db.query('INSERT INTO offline_challenge_submissions VALUES($1,$2,$3)',[mission.id,user,status]);
                }
            } else for(let i=0;i<c.done;i++) {
                const day=`2026-10-${String(c.repeatedDay?1:i+1).padStart(2,'0')}`, valid=i>=Number(c.invalid||0);
                submissions.push({mission_id:mission.id,completion_date:day,is_valid:valid});
                await db.query('INSERT INTO online_challenge_submissions VALUES($1,$2,$3,$4)',[mission.id,user,day,valid]);
            }
        }
        assert.equal(getChallengeProgress(notice,submissions).isSuccess,c.success,`UI case ${n}`);
        assert.equal((await db.query('SELECT count(*)::int n FROM haifn_transactions WHERE user_id=$1',[user])).rows[0].n,0,'Success never pays before close');
        await db.query("UPDATE notices SET program_status='COMPLETED' WHERE id=$1",[n]);
        const paid=async()=>(await db.query('SELECT count(*)::int n FROM haifn_transactions WHERE user_id=$1',[user])).rows[0].n;
        assert.equal(await paid(),c.success?1:0,`SQL reward parity case ${n}`);
        await db.query("UPDATE notices SET program_status='ACTIVE' WHERE id=$1",[n]);
        await db.query("UPDATE notices SET program_status='COMPLETED' WHERE id=$1",[n]);
        assert.equal(await paid(),c.success?1:0,'Reopening cannot duplicate reward');
    }
    const base={challenge_format:'ONLINE',guest_properties:{challenge_reward_criterion:'COUNT',challenge_reward_count:5},challenge_missions:[{id:'m',schedule_type:'FLEXIBLE',target_count:7}]};
    assert.equal(getChallengeProgress(base,Array.from({length:20},()=>({mission_id:'m'}))).completed,7,'Additional posts remain capped in progress');
    console.log(`PASS challenge success: ${caseId} UI/SQL cases, 5-of-7, rounding, legacy defaults, invalid/pending records, daily deduplication, offline, zero missions, close-only and once-only rewards.`);
} finally { await db.close(); }
