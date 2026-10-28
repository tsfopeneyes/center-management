import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {createRoleBoundPool} from '../supabase/functions/_shared/roleBoundPool.mjs';
import {createAccountMergeService} from '../supabase/functions/_shared/accountMergeService.mjs';

const db=new PGlite(),query=(text,values)=>db.query(text,values);
const base={async connect(){return {query,release(){}};}};
const actor='10000000-0000-4000-8000-000000000001',source='10000000-0000-4000-8000-000000000002';
const target='10000000-0000-4000-8000-000000000003';
const authIds=['20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003'];
try{
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_app_meta_data jsonb,is_anonymous boolean,banned_until timestamptz);
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);
      CREATE TABLE public.users(id uuid PRIMARY KEY,auth_user_id uuid UNIQUE,name text NOT NULL,phone text NOT NULL,phone_back4 text NOT NULL,
        birth text,user_group text,preferences jsonb,current_haifn numeric,school text,password text,gender text,church text,role text,status text,
        guardian_name text,guardian_phone text,guardian_relation text,bio text,profile_image_url text,is_master boolean,memo text);
      ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;CREATE POLICY broad_users ON public.users FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
      CREATE TABLE public.logs(id uuid PRIMARY KEY,user_id uuid REFERENCES public.users(id));ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
      CREATE TABLE public.notice_responses(notice_id uuid,user_id uuid REFERENCES public.users(id),status text,PRIMARY KEY(notice_id,user_id));ALTER TABLE public.notice_responses ENABLE ROW LEVEL SECURITY;
      CREATE TABLE public.school_logs(id uuid PRIMARY KEY,participant_ids uuid[]);ALTER TABLE public.school_logs ENABLE ROW LEVEL SECURITY;
      CREATE TABLE public.calling_forest_progress(id uuid PRIMARY KEY,student_id uuid REFERENCES public.users(id),week_number int,UNIQUE(student_id,week_number));ALTER TABLE public.calling_forest_progress ENABLE ROW LEVEL SECURITY;
      CREATE TABLE public.unreviewed_reference(id uuid PRIMARY KEY,user_id uuid REFERENCES public.users(id));`);
    for(const name of ['session','login','migration','credential','registration','membership','roles','bootstrap','profile','member-admin','account-merge'])
        await db.exec(readFileSync(new URL('../supabase/manual/proposals/auth-'+name+'-foundation.sql',import.meta.url),'utf8'));
    await db.exec(`CREATE TABLE public.push_devices(id uuid PRIMARY KEY,user_id uuid REFERENCES public.users(id));ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
      CREATE TABLE public.legacy_community_feed_comment_reactions(id uuid PRIMARY KEY,user_id uuid REFERENCES public.users(id));
      ALTER TABLE public.legacy_community_feed_comment_reactions ENABLE ROW LEVEL SECURITY;`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20260921010000_guest_merge_audit_read_access.sql',import.meta.url),'utf8'));
    await db.exec(`CREATE TABLE public.daily_program_session_responses(session_id uuid,user_id uuid REFERENCES public.users(id),
      status text,is_attended boolean,created_at timestamptz,cancelled_at timestamptz,application_answers jsonb,
      application_form_revision integer,application_form_snapshot jsonb,application_audience text,PRIMARY KEY(session_id,user_id));
      ALTER TABLE public.daily_program_session_responses ENABLE ROW LEVEL SECURITY;
      CREATE TABLE public.open_program_attendance(notice_id uuid,user_id uuid REFERENCES public.users(id),attendance_date date,created_at timestamptz,
      PRIMARY KEY(notice_id,user_id,attendance_date));ALTER TABLE public.open_program_attendance ENABLE ROW LEVEL SECURITY;
      CREATE TABLE public.program_application_attempt_history(id uuid PRIMARY KEY,user_id uuid,status text,application_answers jsonb);
      ALTER TABLE public.program_application_attempt_history ENABLE ROW LEVEL SECURITY;
      CREATE TABLE public.private_messages(id uuid PRIMARY KEY,sender_id uuid REFERENCES public.users(id),private_body text);
      ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION public.calendar_is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
      CREATE FUNCTION public.is_current_profile(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
      CREATE FUNCTION public.is_challenge_host(bigint) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
      REVOKE ALL ON FUNCTION public.calendar_is_admin(),public.is_current_profile(uuid),public.is_challenge_host(bigint) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.calendar_is_admin(),public.is_current_profile(uuid) TO authenticated;
      CREATE POLICY existing_calendar_read ON public.daily_program_session_responses FOR SELECT TO PUBLIC USING(public.calendar_is_admin());
      CREATE TABLE public.offline_challenge_submissions(id uuid PRIMARY KEY,participant_id uuid REFERENCES public.users(id));
      ALTER TABLE public.offline_challenge_submissions ENABLE ROW LEVEL SECURITY;
      CREATE POLICY existing_submission_read ON public.offline_challenge_submissions FOR SELECT TO PUBLIC USING(public.is_current_profile(participant_id) OR public.is_challenge_host(1));
      CREATE TABLE public.offline_challenge_missions(id uuid PRIMARY KEY);
      REVOKE ALL ON public.offline_challenge_missions FROM PUBLIC;
      CREATE FUNCTION public.prepare_offline_challenge_submission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
        PERFORM id FROM public.offline_challenge_missions;
        RETURN NEW;
      END $$;
      CREATE TRIGGER prepare_offline BEFORE UPDATE ON public.offline_challenge_submissions
        FOR EACH ROW EXECUTE FUNCTION public.prepare_offline_challenge_submission();
      CREATE TABLE public.merge_test_notification_events(kind text);
      CREATE FUNCTION public.create_application_state_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
        IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
          INSERT INTO public.merge_test_notification_events VALUES(TG_OP);
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
      END $$;
      CREATE FUNCTION public.guard_program_recruitment_response() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
        IF current_setting('test.program_closed',true)='true' AND
          (TG_OP='DELETE' OR (TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status)) THEN
          RAISE EXCEPTION 'recruitment closed';
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
      END $$;
      CREATE TRIGGER notify_application AFTER INSERT OR UPDATE OF status OR DELETE ON public.notice_responses
        FOR EACH ROW EXECUTE FUNCTION public.create_application_state_notification();
      CREATE TRIGGER guard_application BEFORE UPDATE OR DELETE ON public.notice_responses
        FOR EACH ROW EXECUTE FUNCTION public.guard_program_recruitment_response();`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261019020000_guest_program_merge_continuity.sql',import.meta.url),'utf8'));
    const admin=async work=>{await db.exec('RESET ROLE');try{return await work();}finally{}};
    await query('INSERT INTO auth.users(id,is_anonymous) VALUES($1,false),($2,false)',authIds);
    await query(`INSERT INTO public.users(id,auth_user_id,name,phone,phone_back4,user_group,preferences,current_haifn,school,role,status)
      VALUES($1,$4,'관리자','010-0000-0001','0001','STAFF','{}',0,'센터','admin','approved'),
      ($2,NULL,'임시','010-0000-0002','0002','게스트','{"is_temporary":true}',5,'기존학교','user','approved'),
      ($3,$5,'정식','010-0000-0003','0003','청소년','{}',10,NULL,'user','approved')`,[actor,source,target,...authIds]);
    await query(`INSERT INTO account_security.accounts(profile_id,auth_user_id,mapping_verified,status,must_change_password)
      VALUES($1,$3,true,'active',false),($2,$4,true,'active',false)`,[actor,target,...authIds]);
    await query("INSERT INTO account_security.account_roles(profile_id,role,enabled) VALUES($1,'admin',true),($2,'member',true)",[actor,target]);
    const notice=crypto.randomUUID();await query('INSERT INTO public.logs VALUES($1,$2)',[crypto.randomUUID(),source]);
    await query("INSERT INTO public.notice_responses VALUES($1,$2,'SOURCE')",[notice,source]);
    await query('INSERT INTO public.school_logs VALUES($1,$2)',[crypto.randomUUID(),[source,target]]);
    await query('INSERT INTO public.calling_forest_progress VALUES($1,$2,1)',[crypto.randomUUID(),source]);
    await query('INSERT INTO public.offline_challenge_submissions VALUES($1,$2)',[crypto.randomUUID(),source]);
    const session=crypto.randomUUID();
    await query(`INSERT INTO public.daily_program_session_responses VALUES($1,$2,'JOIN',true,'2026-10-01',NULL,
      '{"reason":"guest answer"}',7,'{"title":"original form"}','GUEST')`,[session,source]);
    await query("INSERT INTO public.open_program_attendance VALUES($1,$2,'2026-10-01','2026-10-01')",[notice,source]);
    await query("INSERT INTO public.program_application_attempt_history VALUES($1,$2,'CANCELLED','{\"old\":true}')",[crypto.randomUUID(),source]);
    const service=createAccountMergeService({pool:createRoleBoundPool(base,'account_merge_worker'),readiness:async()=>true,
      authorize:async()=>({actorProfileId:actor})});
    assert.deepEqual(await service.listReviews({accessToken:'x'}),{protocol:1,status:'ok',reviews:[]});
    const requestId=crypto.randomUUID();
    await assert.rejects(service.merge({accessToken:'x',requestId,sourceProfileId:source,targetProfileId:target}),e=>e.code==='temporarily_unavailable',
      'reproduce production RLS helper execute failure even with a permissive merge policy');
    assert.equal((await query('SELECT count(*)::int n FROM public.users WHERE id=$1',[source])).rows[0].n,1,'failed dependency check preserves source');
    assert.equal(Number((await query('SELECT current_haifn FROM public.users WHERE id=$1',[target])).rows[0].current_haifn),10,'failed dependency check rolls back points');
    await db.exec(readFileSync(new URL('../supabase/migrations/20261019040000_guest_merge_policy_dependencies.sql',import.meta.url),'utf8'));
    assert.deepEqual(await service.merge({accessToken:'x',requestId,sourceProfileId:source,targetProfileId:target}),{protocol:1,status:'merged'});
    assert.equal((await query('SELECT count(*)::int n FROM public.users WHERE id=$1',[source])).rows[0].n,0);
    assert.equal(Number((await query('SELECT current_haifn,school FROM public.users WHERE id=$1',[target])).rows[0].current_haifn),15);
    assert.equal((await query('SELECT user_id FROM public.logs')).rows[0].user_id,target);
    assert.deepEqual((await query('SELECT status FROM public.notice_responses')).rows,[{status:'SOURCE'}]);
    assert.deepEqual((await query('SELECT participant_ids FROM public.school_logs')).rows[0].participant_ids,[target]);
    assert.equal((await query('SELECT count(*)::int n FROM public.calling_forest_progress')).rows[0].n,1);
    assert.equal((await query('SELECT participant_id FROM public.offline_challenge_submissions')).rows[0].participant_id,target,'identity-only offline relink keeps its certification without reopening mission checks');
    assert.deepEqual((await query('SELECT user_id,status,is_attended,application_answers,application_form_revision,application_audience FROM public.daily_program_session_responses')).rows,
      [{user_id:target,status:'JOIN',is_attended:true,application_answers:{reason:'guest answer'},application_form_revision:7,application_audience:'GUEST'}]);
    assert.equal((await query('SELECT user_id FROM public.open_program_attendance')).rows[0].user_id,target);
    assert.equal((await query('SELECT user_id FROM public.program_application_attempt_history')).rows[0].user_id,target);
    assert.equal((await query('SELECT count(*)::int n FROM account_security.account_merge_program_originals')).rows[0].n,4);
    assert.equal((await query("SELECT has_column_privilege('account_merge_worker','public.private_messages','private_body','SELECT') AS allowed")).rows[0].allowed,false);
    assert.deepEqual(await service.merge({accessToken:'x',requestId,sourceProfileId:source,targetProfileId:target}),{protocol:1,status:'merged'});
    const source2=crypto.randomUUID();await admin(()=>query(`INSERT INTO public.users(id,name,phone,phone_back4,user_group,preferences,current_haifn,role,status)
      VALUES($1,'보존임시','010-0000-0004','0004','게스트','{"is_temporary":true}',7,'user','approved')`,[source2]));
    await admin(()=>query('INSERT INTO public.unreviewed_reference VALUES($1,$2)',[crypto.randomUUID(),source2]));
    await admin(()=>query('INSERT INTO public.push_devices VALUES($1,$2)',[crypto.randomUUID(),source2]));
    await assert.rejects(service.merge({accessToken:'x',requestId:crypto.randomUUID(),sourceProfileId:source2,targetProfileId:target}),e=>e.code==='merge_requires_review');
    assert.equal(Number((await query('SELECT current_haifn FROM public.users WHERE id=$1',[target])).rows[0].current_haifn),15);
    assert.equal((await query('SELECT count(*)::int n FROM public.users WHERE id=$1',[source2])).rows[0].n,1);
    const source3=crypto.randomUUID();await admin(()=>query(`INSERT INTO public.users(id,name,phone,phone_back4,user_group,preferences,current_haifn,role,status)
      VALUES($1,'중복임시','010-0000-0005','0005','게스트','{"is_temporary":true}',3,'user','approved')`,[source3]));
    const duplicateNotice=crypto.randomUUID();
    await admin(()=>query("INSERT INTO public.notice_responses VALUES($1,$2,'SOURCE'),($1,$3,'TARGET')",[duplicateNotice,source3,target]));
    await assert.rejects(service.merge({accessToken:'x',requestId:crypto.randomUUID(),sourceProfileId:source3,targetProfileId:target}),e=>e.code==='merge_requires_review');
    assert.equal((await query('SELECT count(*)::int n FROM public.users WHERE id=$1',[source3])).rows[0].n,1);
    assert.equal((await query('SELECT count(*)::int n FROM public.notice_responses WHERE notice_id=$1',[duplicateNotice])).rows[0].n,2);
    const source4=crypto.randomUUID();await admin(()=>query(`INSERT INTO public.users(id,name,phone,phone_back4,user_group,preferences,current_haifn,role,status)
      VALUES($1,'신청임시','010-0000-0006','0006','게스트','{"is_temporary":true}',0,'user','approved')`,[source4]));
    await admin(()=>query(`INSERT INTO public.daily_program_session_responses VALUES($1,$2,'CANCELLED',false,'2026-10-02','2026-10-03',
      '{"reason":"member answer"}',8,'{}','MEMBER')`,[session,source4]));
    const mergedId=crypto.randomUUID();
    await service.merge({accessToken:'x',requestId:mergedId,sourceProfileId:source4,targetProfileId:target});
    const combined=(await query('SELECT * FROM public.daily_program_session_responses WHERE session_id=$1',[session])).rows;
    assert.equal(combined.length,1);assert.equal(combined[0].status,'JOIN');assert.equal(combined[0].is_attended,true);
    assert.equal(combined[0].application_answers.reason,'guest answer');
    const originals=(await query('SELECT row_data FROM account_security.account_merge_program_originals WHERE request_id=$1',[mergedId])).rows;
    assert.equal(originals.length,2);assert.ok(originals.some(r=>r.row_data.application_answers.reason==='member answer'));
    const source5=crypto.randomUUID();await admin(()=>query(`INSERT INTO public.users(id,name,phone,phone_back4,user_group,preferences,current_haifn,role,status)
      VALUES($1,'보호임시','010-0000-0007','0007','게스트','{"is_temporary":true}',0,'user','approved')`,[source5]));
    await admin(()=>query("INSERT INTO public.private_messages VALUES($1,$2,'private')",[crypto.randomUUID(),source5]));
    await assert.rejects(service.merge({accessToken:'x',requestId:crypto.randomUUID(),sourceProfileId:source5,targetProfileId:target}),e=>e.code==='merge_requires_review');
    assert.equal((await query('SELECT count(*)::int n FROM public.users WHERE id=$1',[source5])).rows[0].n,1);
    await admin(()=>db.exec(`ALTER TABLE public.notice_responses ADD COLUMN created_at timestamptz,
      ADD COLUMN cancelled_at timestamptz,ADD COLUMN is_attended boolean,ADD COLUMN is_staff boolean,
      ADD COLUMN application_answers jsonb,ADD COLUMN application_form_revision integer,
      ADD COLUMN application_form_snapshot jsonb,ADD COLUMN application_audience text;`));
    const source6=crypto.randomUUID(),sameProgram=crypto.randomUUID();
    await admin(()=>query(`INSERT INTO public.users(id,name,phone,phone_back4,user_group,preferences,current_haifn,role,status)
      VALUES($1,'프로그램임시','010-0000-0008','0008','게스트','{"is_temporary":true}',0,'user','approved')`,[source6]));
    await admin(()=>query(`INSERT INTO public.notice_responses VALUES
      ($1,$2,'JOIN','2026-10-01',NULL,true,false,'{"guest":"original"}',3,'{"form":3}','GUEST'),
      ($1,$3,'CANCELLED','2026-10-02','2026-10-03',false,true,'{"member":"original"}',4,'{"form":4}','MEMBER')`,
      [sameProgram,source6,target]));
    await admin(()=>query("INSERT INTO public.open_program_attendance VALUES($1,$2,'2026-10-01','2026-10-01'),($1,$3,'2026-10-01','2026-10-02')",[sameProgram,source6,target]));
    const notificationsBefore=(await query('SELECT count(*)::int n FROM public.merge_test_notification_events')).rows[0].n;
    await db.query("SELECT set_config('test.program_closed','true',false)");
    const completedRequest=crypto.randomUUID();
    await service.merge({accessToken:'x',requestId:completedRequest,sourceProfileId:source6,targetProfileId:target});
    const whole=(await query('SELECT * FROM public.notice_responses WHERE notice_id=$1',[sameProgram])).rows;
    assert.equal(whole.length,1);assert.equal(whole[0].user_id,target);assert.equal(whole[0].status,'JOIN');
    assert.equal(whole[0].cancelled_at,null);assert.equal(whole[0].is_attended,true);assert.equal(whole[0].is_staff,true);
    assert.deepEqual(whole[0].application_answers,{guest:'original'});assert.equal(whole[0].application_audience,'GUEST');
    assert.equal((await query('SELECT count(*)::int n FROM public.open_program_attendance WHERE notice_id=$1',[sameProgram])).rows[0].n,1);
    assert.equal((await query('SELECT count(*)::int n FROM public.merge_test_notification_events')).rows[0].n,notificationsBefore,'merge sends no false cancellation or registration notification');
    assert.equal((await query('SELECT count(*)::int n FROM account_security.account_merge_program_originals WHERE request_id=$1',[completedRequest])).rows[0].n,4);
    await service.merge({accessToken:'x',requestId:completedRequest,sourceProfileId:source6,targetProfileId:target});
    assert.equal((await query('SELECT count(*)::int n FROM account_security.account_merge_program_originals WHERE request_id=$1',[completedRequest])).rows[0].n,4,'retry must not duplicate archives');
    await assert.rejects(query("SELECT account_security.merge_reference_has_rows('private_messages','private_body',$1)",[source5]),e=>e.code==='42501');
    console.log('PASS account merge: live admin, temporary-only source, atomic points/activity/arrays, duplicate preservation, idempotent receipt and unknown-reference rollback');
}finally{await db.close();}
