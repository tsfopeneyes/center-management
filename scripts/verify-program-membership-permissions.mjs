import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { connectCommunityDb, communityProject } from './community-db.mjs';

const db = await connectCommunityDb({ cliPath: process.env.COMMUNITY_SUPABASE_CLI });
try {
 await db.query('BEGIN READ ONLY');
 await db.query('SET LOCAL ROLE postgres');
 const accounts = (await db.query(`SELECT a.auth_user_id,a.profile_id FROM account_security.accounts a JOIN users u ON u.id=a.profile_id
 WHERE a.status='active' AND a.mapping_verified AND u.status IS DISTINCT FROM 'withdrawn'`)).rows;
 const channels = (await db.query(`SELECT c.id,community_security.effective_status(c.id) AS status,
 (c.source_notice_id IS NULL OR (n.category='PROGRAM' AND n.community_enabled)) AS valid,
 community_security.is_open_program(c.id) AS open_program,
 ARRAY(SELECT m.user_id FROM community_security.member_ids(c.id) m) AS members
 FROM community_channels c LEFT JOIN notices n ON n.id=c.source_notice_id`)).rows;
 let checks = 0, staffAccounts = 0;
 await db.query('SET LOCAL ROLE authenticated');
 for (const account of accounts) {
   await db.query("SELECT set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true)", [JSON.stringify({sub:account.auth_user_id,role:'authenticated'}),account.auth_user_id]);
   const identity = (await db.query('SELECT public.current_profile_id() AS profile,public.is_current_staff() AS staff')).rows[0];
   assert.equal(identity.profile, account.profile_id);
   if (identity.staff) staffAccounts++;
   const access = (await db.query('SELECT id,public.can_access_community_channel(id) AS allowed FROM unnest($1::uuid[]) id', [channels.map(c=>c.id)])).rows;
   for (const row of access) {
     const channel = channels.find(c=>c.id===row.id);
     const expected = identity.staff || Boolean(channel.status==='ACTIVE' && channel.valid && (channel.open_program || channel.members.includes(account.profile_id)));
     assert.equal(row.allowed, expected, 'live channel access differs from program/staff membership');
     checks++;
   }
 }
 await db.query('ROLLBACK');
 const result = {status:'passed',project:communityProject,accounts:accounts.length,staffAccounts,channels:channels.length,accessChecks:checks,readOnly:true};
 await writeFile('artifacts/program-community/verified-20261019010000.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
} finally { await db.end(); }
