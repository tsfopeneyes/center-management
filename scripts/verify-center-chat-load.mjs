import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {connectCommunityDb,communityProject} from './community-db.mjs';
const {run,center}=JSON.parse(await readFile('.local/chat-load/run.json','utf8'));
const pilot='LOAD_TEST_20261023_1792734148929';
const db=await connectCommunityDb();
try{
 await db.query('BEGIN READ ONLY');await db.query('SET LOCAL ROLE postgres');
 const rows=(await db.query(`SELECT id,center_code,user_name,message,created_at,user_id FROM public.center_daily_chats WHERE center_code=ANY($1::text[]) ORDER BY created_at`,[[center,pilot]])).rows;
 const main=rows.filter(r=>r.center_code===center);
 assert.equal(main.length,30,'Must store exactly one message per test participant');
 assert.equal(new Set(main.map(r=>r.user_name)).size,30);
 assert.ok(main.every(r=>r.user_id===null&&r.message.startsWith(`[동시검증 ${run} `)));
 const submitted=main.map(r=>Number(r.message.split(' ').at(-1)));
 const serverTimes=main.map(r=>new Date(r.created_at).getTime());
 const result={project:communityProject,run,center,checkedAt:new Date().toISOString(),stored:main.length,distinctSenders:30,pilotMessages:rows.length-main.length,totalTestRows:rows.length,
  browserSubmitSpreadMs:Math.max(...submitted)-Math.min(...submitted),databaseInsertSpreadMs:Math.max(...serverTimes)-Math.min(...serverTimes),productionUserAccountsCreated:0,recordsDeleted:0};
 await writeFile('artifacts/chat-load-test/stored-test-messages.json',JSON.stringify(rows,null,2));
 await writeFile('artifacts/chat-load-test/database-verification.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));await db.query('ROLLBACK');
}finally{await db.end();}
