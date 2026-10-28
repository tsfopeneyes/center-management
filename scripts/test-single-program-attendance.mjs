import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
const db=new PGlite();const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;let checks=0;
try{await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE TABLE locations(id text PRIMARY KEY,name text);INSERT INTO locations VALUES('2F 스퀘어','하이픈'),('ENOUGH_PLACE','이높플레이스'),('OTHER','기타');
CREATE TABLE logs(id bigint GENERATED ALWAYS AS IDENTITY,user_id uuid,location_id text,type text,created_at timestamptz);
CREATE TABLE notices(id bigint PRIMARY KEY,category text DEFAULT 'PROGRAM',is_recruiting boolean DEFAULT true,is_challenge boolean DEFAULT false,program_status text DEFAULT 'ACTIVE',guest_properties jsonb DEFAULT '{}',program_date timestamptz DEFAULT '2026-10-23T08:30:00Z',program_location text DEFAULT '하이픈 B1F STAGE');
CREATE TABLE notice_responses(notice_id bigint,user_id uuid,status text,is_attended boolean DEFAULT false,PRIMARY KEY(notice_id,user_id));GRANT INSERT ON logs TO authenticated;GRANT USAGE ON SEQUENCE logs_id_seq TO authenticated;`);
await db.exec(await readFile('supabase/migrations/20261023030000_auto_attend_single_programs.sql','utf8'));
const notice=async(n,changes={})=>{await db.query('INSERT INTO notices(id) VALUES($1)',[n]);for(const [k,v] of Object.entries(changes))await db.query(`UPDATE notices SET ${k}=$1 WHERE id=$2`,[v,n]);};
const join=(n,u,status='JOIN')=>db.query('INSERT INTO notice_responses(notice_id,user_id,status) VALUES($1,$2,$3)',[n,uid(u),status]);
const log=(u,location='2F 스퀘어',date='2026-10-23T01:00:00Z',type='CHECKIN')=>db.query('INSERT INTO logs(user_id,location_id,type,created_at) VALUES($1,$2,$3,$4)',[uid(u),location,type,date]);
const attended=async(n,u)=>(await db.query('SELECT is_attended FROM notice_responses WHERE notice_id=$1 AND user_id=$2',[n,uid(u)])).rows[0].is_attended;
await notice(1);await join(1,1);await db.exec('SET ROLE authenticated');await log(1);await db.exec('RESET ROLE');assert.equal(await attended(1,1),true);checks++;
await notice(2,{program_location:'이높플레이스'});await join(2,2);await log(2);assert.equal(await attended(2,2),false);await log(2,'ENOUGH_PLACE');assert.equal(await attended(2,2),true);checks++;
await notice(3);await join(3,3);await log(3,'OTHER');assert.equal(await attended(3,3),false);checks++;
for(const status of ['WAITLIST','CANCELLED']){const n=status==='WAITLIST'?4:5;await notice(n);await join(n,n,status);await log(n);assert.equal(await attended(n,n),false);checks++;}
await notice(6);await join(6,6);await log(6,'2F 스퀘어','2026-10-22T14:59:59Z');assert.equal(await attended(6,6),false);await log(6,'2F 스퀘어','2026-10-22T15:00:00Z');assert.equal(await attended(6,6),true);checks++;
await notice(7);await log(7);await join(7,7);assert.equal(await attended(7,7),true);checks++;
await db.query("UPDATE notice_responses SET status='JOIN' WHERE notice_id=4");assert.equal(await attended(4,4),true);checks++;
for(const [i,changes] of [{program_status:'COMPLETED'},{program_status:'CANCELLED'},{is_challenge:true},{guest_properties:{schedule_mode:'RECURRING'}},{guest_properties:{is_ended:true}},{is_recruiting:false},{program_location:'하이픈 / 이높플레이스'}].entries()){const n=10+i;await notice(n,changes);await join(n,n);await log(n);assert.equal(await attended(n,n),false);checks++;}
await notice(20);await join(20,20);await log(20,'2F 스퀘어',undefined,'CHECKOUT');await log(20,'2F 스퀘어',undefined,'MOVE');assert.equal(await attended(20,20),false);checks++;
await log(1);assert.equal(await attended(1,1),true);assert.equal((await db.query('SELECT count(*)::int n FROM notice_responses WHERE notice_id=1')).rows[0].n,1);checks++;
await db.query('UPDATE notice_responses SET is_attended=false WHERE notice_id=1');await db.query("UPDATE notice_responses SET status='JOIN' WHERE notice_id=1");assert.equal(await attended(1,1),false);checks++;
await notice(21);await log(21,'ENOUGH_PLACE');await join(21,21);assert.equal(await attended(21,21),false);checks++;
console.log(`PASS ${checks} single-program attendance cases: check-in/join order, authenticated log writer, both centers, unknown/ambiguous center, KST midnight, waitlist/cancelled/completed, challenge/recurring, duplicate check-in and manual attendance preservation.`);
}finally{await db.close()}
