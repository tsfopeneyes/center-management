import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { countMissionCompletions, canWriteMissionPost } from '../src/utils/challengeProgress.js';

const db = new PGlite();
const user = crypto.randomUUID(), other = crypto.randomUUID();
const flex = crypto.randomUUID(), daily = crypto.randomUUID(), fixed = crypto.randomUUID();
const channel1 = crypto.randomUUID(), channel2 = crypto.randomUUID();
try {
    await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role;
      CREATE TABLE public.notices(id bigint PRIMARY KEY,title text,is_challenge boolean DEFAULT true,
        challenge_format text DEFAULT 'ONLINE',community_enabled boolean DEFAULT true,program_start_date date,
        program_end_date date,program_status text DEFAULT 'ACTIVE',haifn_reward int DEFAULT 5,guest_properties jsonb DEFAULT '{}');
      CREATE TABLE public.community_channels(id uuid PRIMARY KEY,source_notice_id bigint,status text DEFAULT 'ACTIVE');
      CREATE TABLE public.community_channel_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),channel_id uuid,author_id uuid,
        content text,is_announcement boolean DEFAULT false,created_at timestamptz DEFAULT now(),updated_at timestamptz,deleted_at timestamptz);
      CREATE TABLE public.community_post_media(post_id uuid,media_url text,sort_order int);
      CREATE TABLE public.online_challenge_missions(id uuid PRIMARY KEY,challenge_id bigint,title text,description text,
        schedule_type text,fixed_date date,target_count int,sort_order int,is_active boolean DEFAULT true,updated_at timestamptz);
      CREATE TABLE public.offline_challenge_missions(LIKE public.online_challenge_missions INCLUDING ALL);
      ALTER TABLE public.offline_challenge_missions ADD COLUMN location text,ADD COLUMN verification_type text;
      CREATE TABLE public.online_challenge_submissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),challenge_id bigint,mission_id uuid,
        participant_id uuid,post_id uuid UNIQUE,completion_date date,completion_key text,is_valid boolean DEFAULT true,invalidated_at timestamptz);
      CREATE UNIQUE INDEX online_submission_active_slot_idx ON public.online_challenge_submissions(mission_id,participant_id,completion_key) WHERE is_valid;
      CREATE TABLE public.offline_challenge_submissions(mission_id uuid,participant_id uuid,status text);
      CREATE TABLE public.notice_responses(notice_id bigint,user_id uuid,status text);
      CREATE TABLE public.challenge_completion_rewards(challenge_id bigint,participant_id uuid,transaction_id uuid,UNIQUE(challenge_id,participant_id));
      CREATE TABLE public.haifn_transactions(id uuid DEFAULT gen_random_uuid(),user_id uuid,amount int,transaction_type text,source_description text,admin_id uuid);
      CREATE FUNCTION public.online_challenge_day() RETURNS date LANGUAGE sql AS $$
        SELECT COALESCE(NULLIF(current_setting('test.day',true),'')::date,(now() AT TIME ZONE 'Asia/Seoul')::date) $$;
      CREATE FUNCTION public.is_current_profile(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1::text=current_setting('test.user',true) $$;
      CREATE FUNCTION public.is_community_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin',true)='true' $$;
      CREATE FUNCTION public.is_challenge_host(bigint) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.host',true)='true' $$;
      CREATE FUNCTION public.community_channel_is_active(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT status='ACTIVE' FROM public.community_channels WHERE id=$1 $$;
      CREATE FUNCTION public.can_access_community_channel(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;`);
    await db.exec(await readFile('supabase/migrations/20261019030000_allow_repeat_mission_posts.sql', 'utf8'));
    const channelMigration=await readFile('supabase/migrations/20261014010000_program_communities.sql','utf8');
    await db.exec(channelMigration.slice(channelMigration.indexOf('CREATE FUNCTION public.create_community_post_with_media('),
        channelMigration.indexOf('CREATE FUNCTION public.update_community_post_with_media(')));
    await db.exec(`CREATE TRIGGER prepare_online BEFORE INSERT ON public.online_challenge_submissions
      FOR EACH ROW EXECUTE FUNCTION public.prepare_online_challenge_submission();
      CREATE TRIGGER settle_rewards AFTER UPDATE ON public.notices
      FOR EACH ROW EXECUTE FUNCTION public.settle_challenge_rewards_on_close();`);
    await db.query("SELECT set_config('test.user',$1,false)", [user]);
    await db.query("INSERT INTO public.notices(id,title,program_start_date,program_end_date) VALUES(1,'daily',public.online_challenge_day()-1,public.online_challenge_day()+1),(2,'flex',public.online_challenge_day()-1,public.online_challenge_day()+1)");
    await db.query('INSERT INTO public.community_channels(id,source_notice_id) VALUES($1,1),($2,2)', [channel1,channel2]);
    const today = (await db.query('SELECT public.online_challenge_day()::text AS day')).rows[0].day;
    await db.query(`INSERT INTO public.online_challenge_missions(id,challenge_id,title,description,schedule_type,fixed_date,target_count,sort_order) VALUES
      ($1,2,'one goal','','FLEXIBLE',NULL,1,0),($2,1,'daily goal','','DAILY',NULL,1,0),($3,2,'fixed goal','','FIXED_DATE',$4,1,1)`, [flex,daily,fixed,today]);
    await db.query("INSERT INTO public.notice_responses VALUES(1,$1,'JOIN'),(2,$1,'JOIN'),(2,$2,'JOIN')",[user,other]);
    const post = async (mission, channel, author=user) => {
        const id = crypto.randomUUID();
        await db.query('BEGIN');
        try {
            await db.query('INSERT INTO public.community_channel_posts(id,channel_id,author_id,content) VALUES($1,$2,$3,$4)',[id,channel,author,'mission post']);
            await db.query('INSERT INTO public.online_challenge_submissions(mission_id,participant_id,post_id) VALUES($1,$2,$3)',[mission,author,id]);
            await db.query('COMMIT');
            return id;
        } catch(error) { await db.query('ROLLBACK'); throw error; }
    };
    const first = await post(flex,channel2);
    await post(flex,channel2); await post(flex,channel2);
    await post(fixed,channel2); await post(fixed,channel2);
    // Existing canonical daily/fixed keys coexist with new per-post keys.
    const legacyDaily=await post(daily,channel1);
    await db.query('UPDATE public.online_challenge_submissions SET completion_key=$1 WHERE post_id=$2',[today,legacyDaily]);
    for(let i=0;i<3;i++) await post(daily,channel1);
    const dailyRows = (await db.query('SELECT * FROM public.online_challenge_submissions WHERE mission_id=$1',[daily])).rows;
    assert.equal(dailyRows.length,4,'all same-day mission posts remain linked');
    assert.equal(countMissionCompletions({id:daily,schedule_type:'DAILY'},dailyRows),1,'daily progress counts days, not posts');
    assert.equal(canWriteMissionPost({id:flex,schedule_type:'FLEXIBLE',target_count:1},{canSubmitMission:true,hasJoined:true,today}),true);
    assert.equal(canWriteMissionPost({id:fixed,schedule_type:'FIXED_DATE',fixed_date:'1900-01-01'},{canSubmitMission:true,hasJoined:true,today}),false);
    // Current UI RPC and its direct-table fallback both keep accepting posts.
    await db.query('SELECT public.create_community_post_with_media($1::jsonb,false)',[JSON.stringify({channel_id:channel2,author_id:user,content:'RPC after goal',mission_id:flex})]);
    const reclassified=crypto.randomUUID();
    await db.query('INSERT INTO public.community_channel_posts(id,channel_id,author_id,content) VALUES($1,$2,$3,$4)',[reclassified,channel2,user,'free post']);
    await db.query('SELECT public.update_online_challenge_post($1,$2,$3,$4)',[reclassified,user,'mission after goal',flex]);
    const corrected=crypto.randomUUID();
    await db.query('INSERT INTO public.community_channel_posts(id,channel_id,author_id,content) VALUES($1,$2,$3,$4)',[corrected,channel2,user,'host correction']);
    await db.query("SELECT set_config('test.host','true',false)");
    await db.query('SELECT public.admin_set_online_post_mission($1,$2)',[corrected,flex]);
    await db.query("SELECT set_config('test.host','false',false)");
    await db.query("UPDATE public.notices SET program_status='COMPLETED' WHERE id=1");
    assert.equal((await db.query('SELECT count(*)::int n FROM public.challenge_completion_rewards WHERE challenge_id=1')).rows[0].n,0,'same-day repeats do not satisfy a three-day goal');
    await db.query("UPDATE public.notices SET program_status='ACTIVE' WHERE id=1");
    const start=(await db.query('SELECT program_start_date::text AS day FROM public.notices WHERE id=1')).rows[0].day;
    const end=(await db.query('SELECT program_end_date::text AS day FROM public.notices WHERE id=1')).rows[0].day;
    for(const day of [start,end]){
        await db.query("SELECT set_config('test.day',$1,false)",[day]);
        await post(daily,channel1);
    }
    await db.query("SELECT set_config('test.day','',false)");
    await db.query("UPDATE public.notices SET program_status='COMPLETED' WHERE id=1");
    assert.equal((await db.query('SELECT count(*)::int n FROM public.challenge_completion_rewards WHERE challenge_id=1')).rows[0].n,1,'distinct daily dates satisfy the goal');
    await db.query("UPDATE public.notices SET program_status='COMPLETED' WHERE id=2");
    assert.equal((await db.query('SELECT count(*)::int n FROM public.haifn_transactions WHERE source_description LIKE \'[챌린지 완료 #2]%\'')).rows[0].n,1,'unlimited posts still award only once');
    await db.query("UPDATE public.notices SET program_status='ACTIVE' WHERE id=2");
    await post(flex,channel2);
    await db.query("UPDATE public.notices SET program_status='COMPLETED' WHERE id=2");
    assert.equal((await db.query('SELECT count(*)::int n FROM public.haifn_transactions WHERE source_description LIKE \'[챌린지 완료 #2]%\'')).rows[0].n,1,'re-close cannot duplicate rewards');
    await db.query("SELECT set_config('test.admin','true',false)");
    const before = (await db.query('SELECT * FROM public.online_challenge_submissions ORDER BY id')).rows;
    await db.query('SELECT public.sync_challenge_missions(2,\'ONLINE\',$1::jsonb)',[JSON.stringify([
        {id:flex,title:'renamed goal',schedule_type:'FLEXIBLE',target_count:1},
        {id:fixed,title:'renamed fixed',schedule_type:'FIXED_DATE',fixed_date:today,target_count:1},
    ])]);
    assert.deepEqual((await db.query('SELECT * FROM public.online_challenge_submissions ORDER BY id')).rows,before,'rename keeps all submission IDs and contents');
    assert.equal((await db.query('SELECT title FROM public.online_challenge_missions WHERE id=$1',[flex])).rows[0].title,'renamed goal');
    // Auth, date and registered-participant requirements remain authoritative.
    await db.query("SELECT set_config('test.admin','false',false)");
    await assert.rejects(post(flex,channel2,other),/본인의 챌린지/);
    await db.query('DELETE FROM public.notice_responses WHERE user_id=$1',[user]);
    await assert.rejects(post(flex,channel2),/챌린지 참여자만/);
    await db.query("INSERT INTO public.notice_responses VALUES(2,$1,'JOIN')",[user]);
    await db.query("UPDATE public.notices SET program_end_date=public.online_challenge_day()-1 WHERE id=2");
    await assert.rejects(post(flex,channel2),/챌린지 수행 기간/);
    assert.equal((await db.query('SELECT post_id FROM public.online_challenge_submissions WHERE post_id=$1',[first])).rows.length,1);
    console.log('PASS repeat mission posts: unlimited flexible/daily/fixed posts, daily deduplication, capped once-only rewards, stable rename IDs, auth/period/application guards.');
} finally { await db.close(); }
