import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const id=i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
const guest=id(1),wait=id(2),cancel=id(3),member=id(4),fresh=id(5);
const hash='a'.repeat(64),client='b'.repeat(64),subject='c'.repeat(64);
try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE SCHEMA account_security;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('test.role',true) $$;
 CREATE FUNCTION account_security.current_profile_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT nullif(current_setting('test.profile',true),'')::uuid $$;
 CREATE FUNCTION public.current_profile_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT account_security.current_profile_id() $$;
 CREATE FUNCTION public.is_current_profile(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT p=account_security.current_profile_id() $$;
 CREATE FUNCTION public.is_current_staff() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.staff',true)='true' $$;
 CREATE TABLE users(id uuid PRIMARY KEY,name text,school text,profile_image_url text,status text,user_group text,phone text,birth text);
 CREATE TABLE notices(id bigint PRIMARY KEY,title text,category text DEFAULT 'PROGRAM',is_challenge boolean DEFAULT false,challenge_format text DEFAULT 'OFFLINE',community_enabled boolean DEFAULT false,is_recruiting boolean DEFAULT true,recruitment_start_at timestamptz,guest_properties jsonb DEFAULT '{}',program_start_date date,program_end_date date);
 CREATE TABLE community_channels(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,description text DEFAULT '',channel_type text,source_notice_id bigint UNIQUE REFERENCES notices(id),status text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 CREATE TABLE notice_responses(notice_id bigint,user_id uuid,status text);
 CREATE TABLE community_channel_members(channel_id uuid,user_id uuid,member_role text DEFAULT 'MEMBER',PRIMARY KEY(channel_id,user_id));
 CREATE TABLE daily_program_sessions(id uuid PRIMARY KEY,notice_id bigint,voided_at timestamptz);
 CREATE TABLE daily_program_session_responses(session_id uuid,user_id uuid,status text,is_attended boolean DEFAULT false);
 CREATE TABLE community_channel_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),channel_id uuid,author_id uuid,content text,image_url text,is_announcement boolean DEFAULT false,announced_at timestamptz,deleted_at timestamptz,is_hidden boolean DEFAULT false,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 CREATE TABLE community_channel_comments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id uuid,user_id uuid,content text,is_hidden boolean DEFAULT false,deleted_at timestamptz,created_at timestamptz DEFAULT now());
 CREATE TABLE community_channel_reactions(post_id uuid,user_id uuid,emoji text,PRIMARY KEY(post_id,user_id,emoji));
 CREATE TABLE community_channel_comment_reactions(comment_id uuid,user_id uuid,emoji text,PRIMARY KEY(comment_id,user_id,emoji));
 CREATE TABLE community_channel_read_cursors(channel_id uuid,user_id uuid,last_read_at timestamptz,updated_at timestamptz DEFAULT now(),PRIMARY KEY(channel_id,user_id));
 CREATE TABLE community_post_media(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id uuid,media_type text DEFAULT 'IMAGE',media_url text,sort_order integer,CHECK(media_url<>'invalid'));
 CREATE TABLE online_challenge_missions(id uuid PRIMARY KEY,challenge_id bigint,title text,is_active boolean DEFAULT true);
 CREATE TABLE online_challenge_submissions(id uuid DEFAULT gen_random_uuid(),challenge_id bigint,mission_id uuid,participant_id uuid,post_id uuid,completion_date date,completion_key text,is_valid boolean DEFAULT true);
 CREATE TABLE community_post_push_digests(channel_id uuid,user_id uuid,local_date date,post_ids uuid[] DEFAULT '{}',comment_ids uuid[] DEFAULT '{}',next_attempt_at timestamptz,updated_at timestamptz,UNIQUE(channel_id,user_id,local_date));
 CREATE TABLE community_post_push_recipients(post_id uuid,user_id uuid,PRIMARY KEY(post_id,user_id));
 CREATE TABLE community_comment_push_recipients(comment_id uuid,post_id uuid,user_id uuid);
 CREATE FUNCTION public.update_online_challenge_post(uuid,uuid,text,uuid) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN IF NOT public.is_current_profile($2) THEN RAISE EXCEPTION 'not author'; END IF; RAISE EXCEPTION 'mission validator'; END $$;
 CREATE FUNCTION public.replace_community_post_media(post uuid,author uuid,expected text[],next text[]) RETURNS void LANGUAGE plpgsql AS $$
 BEGIN IF NOT public.is_current_profile(author) THEN RAISE EXCEPTION 'not author'; END IF;
 IF ARRAY(SELECT media_url FROM community_post_media WHERE post_id=post ORDER BY sort_order)<>expected THEN RAISE EXCEPTION 'gallery changed'; END IF;
 DELETE FROM community_post_media WHERE post_id=post;
 INSERT INTO community_post_media(post_id,media_url,sort_order) SELECT post,url,ordinal-1 FROM unnest(next) WITH ORDINALITY AS x(url,ordinal); END $$;
 CREATE FUNCTION public.mark_community_channel_read(uuid,uuid,timestamptz) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NOT public.is_current_profile($2) OR NOT public.can_access_community_channel($1) THEN RAISE EXCEPTION 'no access'; END IF;
 INSERT INTO community_channel_read_cursors(channel_id,user_id,last_read_at) VALUES($1,$2,$3)
 ON CONFLICT(channel_id,user_id) DO UPDATE SET last_read_at=EXCLUDED.last_read_at; END $$;
 SET test.profile=''; SET test.staff='true'; SET test.role='authenticated';
 `);
 for(const name of ['20261014010000_program_communities','20261014020000_session_community_opening','20261014030000_community_member_rejoin','20261014050000_guest_community_access','20261019010000_program_community_application_membership'])
   await db.exec(await readFile(`supabase/migrations/${name}.sql`,'utf8'));
 await db.exec("ALTER TABLE notices ADD COLUMN host_id uuid,ADD COLUMN host_ids uuid[] DEFAULT '{}',ADD COLUMN hosts jsonb DEFAULT '[]';");
 await db.exec(`INSERT INTO users(id,name,school,status,user_group,phone,birth) VALUES
 ('${guest}','기존게스트(guest)','검증학교','approved','게스트','010-0000-1001','100803'),
 ('${wait}','대기게스트','검증학교','approved','게스트','010-0000-1002','100803'),
 ('${cancel}','취소게스트','검증학교','approved','게스트','010-0000-1003','100803'),
 ('${member}','회원','검증학교','approved','청소년','010-0000-1004','100803');
 INSERT INTO notices(id,title,community_enabled,recruitment_start_at) VALUES(1,'Program',true,now()-interval '1 day'),(2,'Another',true,now()-interval '1 day');
 INSERT INTO notice_responses VALUES(1,'${guest}','JOIN'),(2,'${guest}','JOIN'),(1,'${wait}','WAITLIST'),(1,'${cancel}','CANCELLED');
 SET test.staff='false'; SET ROLE community_guest_worker;`);
 await db.exec('RESET ROLE');
 const channels=await db.query('SELECT id,source_notice_id FROM community_channels ORDER BY source_notice_id');
 const channel=channels.rows[0].id,otherChannel=channels.rows[1].id;
 await db.exec('SET ROLE community_guest_worker');
 const verify=async(name,pin,tokenHash=hash,subjectKey=subject)=>(await db.query('SELECT community_security.verify_guest($1,$2,$3,$4,$5,$6) AS result',[channel,name,pin,client,subjectKey,tokenHash])).rows[0].result;
 const action=async(type,payload={},targetChannel=channel,tokenHash=hash)=>(await db.query('SELECT community_security.guest_action($1,$2,$3,$4) AS result',[tokenHash,targetChannel,type,payload])).rows[0].result;
 assert.equal((await verify('既存','1001')).allowed,false,'wrong name is rejected');
 assert.equal((await verify('기존게스트','9999')).allowed,false,'a shared default PIN is rejected');
 assert.equal((await verify('대기게스트','1002',hash,'d'.repeat(64))).allowed,false);
 assert.equal((await verify('취소게스트','1003',hash,'e'.repeat(64))).allowed,false);
 assert.equal((await verify('회원','1004',hash,'f'.repeat(64))).allowed,false,'member identity cannot be claimed as guest');
 const accepted=await verify('기존게스트','1001');
 assert.equal(accepted.allowed,true,'existing confirmed guest is supported without new account or reapplication');
 assert.equal(accepted.context.user.id,guest);
 assert.equal((await db.query('SELECT public.current_profile_id() AS id')).rows[0].id,null,'guest community verification does not become an account session');
 assert.equal((await action('candidates'))[0].id,guest);
 await assert.rejects(db.query('SELECT * FROM public.users'),/permission denied/,'worker has no raw member directory access');
 await assert.rejects(action('context',{},otherChannel),/guest_access_denied/,'token cannot enter another eligible community');
 await assert.rejects(action('context',{},channel,'9'.repeat(64)),/guest_access_denied/);
 const post=await action('create_post',{content:'Guest post',author_id:member,channel_id:otherChannel,image_urls:['photo1','photo2']});
 const posts=await action('posts');
 assert.equal(posts[0].author_id,guest,'client cannot spoof author');assert.equal(posts[0].channel_id,channel,'client cannot spoof channel');
 assert.equal(posts[0].media.length,2);
 const comment=await action('create_comment',{id:post,content:'Guest comment'});
 assert.equal(await action('post_reaction',{id:post,emoji:'❤️'}),true);
 assert.equal(await action('comment_reaction',{id:comment,emoji:'👍'}),true);
 await action('edit_post',{id:post,content:'Edited post',mission_id:null});
 await action('edit_comment',{id:comment,content:'Edited comment'});
 const feed=await action('posts');
 assert.equal(feed[0].content,'Edited post');assert.equal(feed[0].community_channel_comments[0].content,'Edited comment');
 assert.equal(feed[0].community_channel_reactions.length,1);assert.equal(feed[0].community_channel_comments[0].community_channel_comment_reactions.length,1);
 await action('mark_read',{read_at:new Date().toISOString()});assert.ok(await action('read_at'));
 await assert.rejects(action('create_post',{content:'Atomic failure',image_urls:['valid','invalid']}),/check constraint/);
 assert.equal((await action('posts')).length,1,'media failure leaves no partial post');
 await db.exec(`RESET ROLE; UPDATE notice_responses SET status='CANCELLED' WHERE notice_id=1 AND user_id='${guest}'; SET ROLE community_guest_worker;`);
 await assert.rejects(action('create_post',{content:'Not allowed'}),/guest_access_denied/,'cancellation revokes a still-live token');
 await db.exec(`RESET ROLE; UPDATE notice_responses SET status='JOIN' WHERE notice_id=1 AND user_id='${guest}'; UPDATE community_channels SET status='CLOSED' WHERE id='${channel}'; SET ROLE community_guest_worker;`);
 await assert.rejects(action('posts'),/guest_access_denied/,'manual closure revokes guest access');
 await db.exec(`RESET ROLE; UPDATE community_channels SET status='ACTIVE' WHERE id='${channel}'; UPDATE community_security.guest_sessions SET expires_at=now()-interval '1 second'; SET ROLE community_guest_worker;`);
 await assert.rejects(action('posts'),/guest_access_denied/,'expiry is enforced');
 await db.exec(`RESET ROLE; SET ROLE authenticated;`);
 await assert.rejects(action('posts'),/permission denied/,'member cannot invoke guest worker operation');
 await db.exec(`RESET ROLE; INSERT INTO notice_responses VALUES(1,'${member}','JOIN'); SET test.profile='${member}'; SET ROLE authenticated;`);
 assert.equal((await db.query('SELECT public.can_access_community_channel($1) AS allowed',[channel])).rows[0].allowed,true,'ordinary authenticated member access still works');
 await db.exec("RESET ROLE; SET test.profile='';");
 await db.exec(`RESET ROLE; INSERT INTO users(id,name,school,status,user_group,phone,birth) VALUES('${fresh}','새게스트','검증학교','approved','게스트','010-0000-1005','100803'); INSERT INTO notice_responses VALUES(1,'${fresh}','JOIN'); SET ROLE community_guest_worker;`);
 assert.equal((await verify('새게스트','1005','8'.repeat(64),'7'.repeat(64))).allowed,true,'newly registered confirmed guest uses the same flow');
 assert.equal(await action('logout',{},channel,'8'.repeat(64)),true);
 await assert.rejects(action('posts',{},channel,'8'.repeat(64)),/guest_access_denied/,'logout revokes the server token');
 for(let i=0;i<5;i++) await verify('새게스트','0001','6'.repeat(64),'5'.repeat(64));
 assert.equal((await verify('새게스트','1005','6'.repeat(64),'5'.repeat(64))).code,'try_later','failed attempts remain counted');
 await db.exec(`RESET ROLE; INSERT INTO users(id,name,school,status,user_group,phone,birth) VALUES('${id(6)}','기존게스트','다른학교','approved','게스트','010-1111-1001','990101'); INSERT INTO notice_responses VALUES(1,'${id(6)}','JOIN'); SET ROLE community_guest_worker;`);
 assert.equal((await verify('기존게스트','1001','4'.repeat(64),'3'.repeat(64))).allowed,false,'ambiguous name and PIN must never choose an arbitrary applicant');
 console.log('PASS guest community: existing/new guest identity, scoped token, no account access, shared post/photo/comment/reaction operations, cancellation, closure, expiry and rate limits');
}catch(error){console.error(error.code,error.message,error.position||'',error.where||'');process.exitCode=1;}
finally{await db.close();}
