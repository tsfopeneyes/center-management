import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createGuestLoginService} from '../supabase/functions/_shared/guestLoginService.mjs';
import {createRoleBoundPool} from '../supabase/functions/_shared/roleBoundPool.mjs';
import {createLoginKey} from '../supabase/functions/_shared/loginSecurity.mjs';
import {createLegacyCredentialBridge} from '../supabase/functions/_shared/legacyCredentialBridge.mjs';
import {createMembershipFinalizer} from '../supabase/functions/_shared/membershipFinalizer.mjs';
import {createRegistrationFormValidator} from '../supabase/functions/_shared/registrationForm.mjs';
import {TERMS_VERSION} from '../src/constants/appConstants.js';
const db=new PGlite(),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const old=id(1),fresh=id(2),member=id(3),legacy=id(4);
const keyFor=await createLoginKey('fixture-only-guest-login-lookup-key-1234567890');
const bridge=await createLegacyCredentialBridge('fixture-only-guest-provider-bridge-key-1234567890');
const pool={connect:async()=>({query:(sql,args)=>db.query(sql,args),release(){}})};
let creates=0,issued=0,hook=null,createFailure=null;const passwords=new Map(),principals=new Map();
const adminAuth={async createUser(input){creates++;if(createFailure==='before'){createFailure=null;return {data:null,error:{status:503}};}
 const uid=crypto.randomUUID();passwords.set(input.email,{uid,password:input.password});
 await db.query('INSERT INTO auth.users(id,email,raw_app_meta_data,is_anonymous) VALUES($1,$2,$3,false)',[uid,input.email,input.app_metadata]);
 if(createFailure==='after'){createFailure=null;return {data:null,error:{status:503}};}return {data:{user:{id:uid}},error:null};},
 async findUserByEmail(email,operation,profile){const rows=(await db.query(`SELECT id FROM auth.users WHERE email=$1 AND raw_app_meta_data->>'guest_login_operation'=$2 AND raw_app_meta_data->>'guest_login_profile'=$3`,[email,operation,profile])).rows;return {data:{user:rows[0]||null},error:null};}};
const gateway={async signIn(email,password){const provider=passwords.get(email);assert.ok(provider);assert.equal(password,provider.password);
 const sid=crypto.randomUUID(),token='fixture-guest-token-'+(++issued);await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[sid,provider.uid]);
 principals.set(token,{authUserId:provider.uid,sessionId:sid,live:true,isAnonymous:false,expiresAt:Date.now()+3600000});
 if(hook){const callback=hook;hook=null;await callback();}return {user:{id:provider.uid},access_token:token,refresh_token:'fixture-refresh-'+issued};},
 async discardCreatedSession(token){const p=principals.get(token);if(p)await db.query('DELETE FROM auth.sessions WHERE id=$1',[p.sessionId]);}};
const verifyToken=async token=>principals.get(token);verifyToken.created=verifyToken;
const login=createGuestLoginService({pool:createRoleBoundPool(pool,'account_guest_login_worker'),keyFor,bridge,adminAuth,gateway,verifyToken,
 readiness:async()=>true,loginDomain:'fixture.invalid',assuranceTtlMs:86400000});
const attempt=(name,password,extra={})=>login({action:'login',protocol:1,name,password,...extra},{clientKey:'fixture-client'});
const byId=(profileId,password)=>login({action:'login',protocol:1,profileId,password},{clientKey:'fixture-client'});
try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE community_guest_worker;
 CREATE SCHEMA auth;CREATE SCHEMA community_security;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text UNIQUE,raw_app_meta_data jsonb DEFAULT '{}',is_anonymous boolean DEFAULT false,banned_until timestamptz);
 CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);
 CREATE TABLE public.users(id uuid PRIMARY KEY,auth_user_id uuid UNIQUE,created_at timestamptz DEFAULT now(),name text,gender text,school text,church text,birth text,
 phone text,phone_back4 text,user_group text,role text DEFAULT 'user',status text DEFAULT 'approved',is_master boolean DEFAULT false,preferences jsonb DEFAULT '{}',
 password text,memo text,guardian_name text,guardian_phone text,guardian_relation text);
 ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;`);
 for(const file of ['auth-session-foundation','auth-login-foundation','auth-registration-foundation'])await db.exec(await readFile(`supabase/manual/proposals/${file}.sql`,'utf8'));
 await db.exec(`CREATE TABLE account_security.account_roles(profile_id uuid PRIMARY KEY,role text,enabled boolean DEFAULT true);
 CREATE TABLE account_security.member_terms_consents(profile_id uuid,auth_user_id uuid,session_id uuid,terms_version text,source text,art1 boolean,art2 boolean,art3 boolean,art4 boolean,accepted_at timestamptz,UNIQUE(profile_id,terms_version));`);
 await db.exec(await readFile('supabase/manual/proposals/auth-membership-foundation.sql','utf8'));
 await db.exec(`CREATE TABLE notices(id bigint PRIMARY KEY,category text DEFAULT 'PROGRAM',community_enabled boolean DEFAULT true);
 CREATE TABLE notice_responses(notice_id bigint,user_id uuid,status text);
 CREATE TABLE community_channels(id uuid PRIMARY KEY,source_notice_id bigint,status text);
 CREATE TABLE posts(id uuid PRIMARY KEY,author_id uuid,content text);
 CREATE FUNCTION account_security.current_profile_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
 SELECT a.profile_id FROM account_security.accounts a JOIN account_security.session_assurances s ON s.profile_id=a.profile_id AND s.auth_user_id=a.auth_user_id AND s.credential_version=a.credential_version
 WHERE a.auth_user_id=nullif(current_setting('test.auth_id',true),'')::uuid AND s.session_id=nullif(current_setting('test.session_id',true),'')::uuid AND s.status='trusted' AND s.valid_until>now() $$;
 CREATE FUNCTION public.is_current_profile(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT $1=account_security.current_profile_id()$$;
 CREATE FUNCTION public.is_current_staff() RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
 CREATE FUNCTION community_security.effective_status(uuid) RETURNS text LANGUAGE sql AS $$SELECT status FROM public.community_channels WHERE id=$1$$;
 CREATE FUNCTION community_security.is_open_program(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
 CREATE FUNCTION community_security.member_ids(uuid) RETURNS TABLE(user_id uuid) LANGUAGE sql AS $$SELECT r.user_id FROM public.notice_responses r JOIN public.community_channels c ON c.source_notice_id=r.notice_id WHERE c.id=$1 AND r.status='JOIN'$$;
 CREATE FUNCTION public.create_community_post_with_media(jsonb,boolean) RETURNS uuid LANGUAGE sql AS $$SELECT gen_random_uuid()$$;
 CREATE FUNCTION public.update_community_post_with_media(jsonb) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
 CREATE FUNCTION public.update_online_challenge_post(uuid,uuid,text,uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
 CREATE FUNCTION public.replace_community_post_media(uuid,uuid,text[],text[]) RETURNS void LANGUAGE sql AS $$SELECT$$;
 CREATE FUNCTION public.mark_community_channel_read(uuid,uuid,timestamptz) RETURNS void LANGUAGE sql AS $$SELECT$$;
 CREATE FUNCTION community_security.verify_guest(uuid,text,text,text,text,text) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
 CREATE FUNCTION community_security.guest_action(text,uuid,text,jsonb) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
 INSERT INTO public.users(id,name,school,birth,phone,phone_back4,user_group) VALUES
 ('${old}','기존게스트(guest)','검증학교','080315','010-0000-0123','0123','게스트'),
 ('${member}','일반회원','검증학교','080315','010-0000-4567','4567','청소년'),
 ('${legacy}','로그인게스트','검증학교','080315','010-0000-8888','8888','게스트');
 INSERT INTO notices VALUES(1,'PROGRAM',true);INSERT INTO community_channels VALUES('${id(50)}',1,'ACTIVE');
 INSERT INTO notice_responses VALUES(1,'${old}','JOIN');INSERT INTO posts VALUES('${id(51)}','${old}','Existing guest post');
 INSERT INTO auth.users(id,email) VALUES('${id(104)}','legacy@fixture.invalid');
 INSERT INTO account_security.accounts VALUES('${legacy}','${id(104)}',true,'active',1,false);
 INSERT INTO account_security.account_roles VALUES('${legacy}','member',true);
 INSERT INTO account_security.login_identifiers VALUES('${legacy}','legacy@fixture.invalid','${'a'.repeat(64)}','${'b'.repeat(64)}','legacy_bridge',true);
 INSERT INTO account_security.legacy_credentials(profile_id,password_digest) VALUES('${legacy}','${'c'.repeat(64)}');`);
 passwords.set('legacy@fixture.invalid',{uid:id(104),password:await bridge.providerPassword(legacy,'c'.repeat(64))});
 await db.exec(await readFile('supabase/migrations/20261014060000_guest_main_login.sql','utf8'));
 assert.equal(await attempt('일반회원','4567'),null,'member last four digits cannot use the guest path');
 await assert.rejects(attempt('기존게스트','9999'),e=>e.code==='invalid_login');assert.equal(creates,0);
 const result=await attempt('기존게스트','0123');assert.equal(result.profileId,old);assert.notEqual(result.authUserId,old);assert.equal(creates,1);
 assert.equal((await db.query('SELECT user_group,password FROM public.users WHERE id=$1',[old])).rows[0].user_group,'게스트');
 assert.equal((await db.query('SELECT author_id FROM posts')).rows[0].author_id,old,'author identity is preserved');
 const principal=principals.get(result.session.access_token);
 await db.query("SELECT set_config('test.auth_id',$1,false),set_config('test.session_id',$2,false)",[result.authUserId,principal.sessionId]);
 assert.equal((await db.query('SELECT public.can_access_community_channel($1) AS allowed',[id(50)])).rows[0].allowed,true);
 await db.query("UPDATE notice_responses SET status='CANCELLED' WHERE user_id=$1",[old]);
 assert.equal((await db.query('SELECT public.can_access_community_channel($1) AS allowed',[id(50)])).rows[0].allowed,false,'cancellation affects permissions, not login history');
 await attempt('기존게스트(guest)','0123');assert.equal(creates,1,'repeat login reuses one Auth account');
 await attempt('로그인게스트','8888');assert.equal(creates,1,'already mapped guests keep their Auth identity');
 await db.query('INSERT INTO public.users(id,name,school,birth,phone,phone_back4,user_group) VALUES($1,$2,$3,$4,$5,$6,$7)',[fresh,'신규게스트','검증학교','080315','010-0000-4567','4567','게스트']);
 assert.equal((await byId(fresh,'4567')).profileId,fresh,'new guest is enrolled by the registration trigger');
 await db.query("UPDATE public.users SET user_group='게스트' WHERE id=$1",[member]);
 assert.equal(await attempt('일반회원','4567'),null,'editing public group cannot enroll an existing member');
 await db.query('INSERT INTO public.users(id,name,school,phone,user_group) VALUES($1,$2,$3,$4,$5),($6,$2,$7,$8,$5)',[id(7),'동명이인','학교A','01000007001','게스트',id(8),'학교B','01000007002']);
 await assert.rejects(attempt('동명이인','7001'),e=>e.code==='selection_required');
 assert.equal((await byId(id(7),'7001')).profileId,id(7),'duplicate names require choosing the exact guest');
 await db.query('UPDATE account_security.accounts SET must_change_password=true WHERE profile_id=$1',[legacy]);
 await assert.rejects(byId(legacy,'8888'),e=>e.code==='invalid_login','guest PIN never bypasses an account restriction');
 await db.exec('SET ROLE account_guest_login_worker');await assert.rejects(db.query('SELECT * FROM public.users'),/permission denied/);await db.exec('RESET ROLE');
 hook=()=>db.query("UPDATE public.users SET phone='010-0000-7777' WHERE id=$1",[fresh]);
 await assert.rejects(byId(fresh,'4567'),e=>e.code==='invalid_login','contact change during login invalidates the prepared proof');
 for(const [number,stage] of [[11,'after'],[12,'before']]){
  const profile=id(number);await db.query('INSERT INTO public.users(id,name,phone,user_group) VALUES($1,$2,$3,$4)',[profile,'통신오류검증'+number,'01000009000','게스트']);
  createFailure=stage;await assert.rejects(byId(profile,'9000'),e=>e.code==='temporarily_unavailable');
  if(stage==='before')await db.query("UPDATE account_security.guest_login_provisions SET claim_started_at=clock_timestamp()-interval '31 seconds' WHERE profile_id=$1",[profile]);
  assert.equal((await byId(profile,'9000')).profileId,profile,'lost or failed Auth creation recovers without a second identity');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM auth.users WHERE raw_app_meta_data->>'guest_login_profile'=$1",[profile])).rows[0].n,1);
 }
 const validateForm=createRegistrationFormValidator({termsVersion:TERMS_VERSION});
 const submission={guestUserId:old,termsVersion:TERMS_VERSION,agreements:{art1:true,art2:true,art3:true,art4:true},formData:{name:'기존게스트',gender:'M',school:'검증학교',church:'',birth:'080315',phone:'01000000123',user_group:'청소년',password:'123456',confirmPassword:'123456',guardianName:'',guardianPhone:'',guardianRelation:'',isSchoolChurch:true}};
 const op=crypto.randomUUID(),requestSecret='x'.repeat(43),newAuth=crypto.randomUUID(),newSession=crypto.randomUUID();
 const detailsKey=await keyFor('registration-details',validateForm(submission).canonicalDetails);
 await db.query('INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,$2,$3)',[newAuth,'new-member@fixture.invalid',{registration_operation:op}]);
 await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[newSession,newAuth]);
 await db.query(`INSERT INTO account_security.registration_operations(id,request_key,identity_key,details_key,login_email,state,auth_user_id,valid_until,ready_at) VALUES($1,$2,$3,$4,$5,'auth_ready',$6,now()+interval '1 hour',now())`,[op,await keyFor('registration-request',requestSecret),await keyFor('identity','fixture'),detailsKey,'new-member@fixture.invalid',newAuth]);
 principals.set('fixture-member',{authUserId:newAuth,sessionId:newSession,live:true,isAnonymous:false,expiresAt:Date.now()+3600000});
 const finalize=createMembershipFinalizer({pool:createRoleBoundPool(pool,'account_membership_worker'),keyFor,validateForm,verifyToken,readiness:async()=>true,mappedGuestUpgrade:true});
 const upgrade={operationId:op,requestSecret,submission,accessToken:'fixture-member'};
 // Membership conversion must preserve the guest identity and every application
 // field without copying or recreating operational rows.
 await db.exec(`ALTER TABLE notice_responses ADD COLUMN application_answers jsonb,ADD COLUMN application_audience text;
 CREATE TABLE daily_program_session_responses(session_id uuid,user_id uuid REFERENCES public.users(id),status text,
 is_attended boolean,application_answers jsonb,application_form_revision integer,application_audience text);
 CREATE TABLE open_program_attendance(notice_id bigint,user_id uuid REFERENCES public.users(id),attendance_date date);`);
 await db.query(`UPDATE notice_responses SET application_answers='{"reason":"guest original"}',application_audience='GUEST' WHERE user_id=$1`,[old]);
 await db.query(`INSERT INTO daily_program_session_responses VALUES($1,$2,'JOIN',true,'{"choice":"original"}',4,'GUEST')`,[id(70),old]);
 await db.query(`INSERT INTO open_program_attendance VALUES(1,$1,'2026-10-19')`,[old]);
 const activities=async()=>({applications:(await db.query('SELECT * FROM notice_responses')).rows,
 sessions:(await db.query('SELECT * FROM daily_program_session_responses')).rows,
 attendance:(await db.query('SELECT * FROM open_program_attendance')).rows});
 const beforeConversion=await activities();
 await assert.rejects(finalize(upgrade),e=>e.code==='registration_review_required','mapped guest upgrade requires their current Auth proof');
 assert.deepEqual(await finalize({...upgrade,guestAccessToken:result.session.access_token}),{protocol:1,status:'registered'});
 assert.equal((await db.query('SELECT user_group,auth_user_id FROM public.users WHERE id=$1',[old])).rows[0].auth_user_id,newAuth);
 assert.equal((await db.query('SELECT author_id FROM posts')).rows[0].author_id,old);
 assert.deepEqual(await activities(),beforeConversion,'conversion keeps the same guest program rows, answers, attendance, and application-time audience');
 assert.equal((await db.query('SELECT count(*)::int n FROM public.users WHERE id=$1',[newAuth])).rows[0].n,0,'conversion must not create a second profile');
 assert.equal((await db.query('SELECT enabled FROM account_security.guest_login_profiles WHERE profile_id=$1',[old])).rows[0].enabled,false);
 assert.equal((await db.query('SELECT account_security.current_profile_id() AS id')).rows[0].id,null,'old guest session loses access on conversion');
 console.log('PASS guest main login: shared native sessions, stable history/author IDs, wrong PIN/member denial, repeat/new/legacy guests, cancellation, contact race, private worker and membership conversion');
}catch(error){console.error(error.code||'',error.message,error.where||'',error.position||'');process.exitCode=1;}
finally{await db.close();}
