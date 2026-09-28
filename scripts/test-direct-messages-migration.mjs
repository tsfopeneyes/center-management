import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
  CREATE SCHEMA auth;
  CREATE SCHEMA account_security;
  CREATE SCHEMA storage;
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
  CREATE TABLE public.users (
    id uuid PRIMARY KEY,
    name text,
    status text,
    school text,
    profile_image_url text,
    user_group text,
    role text,
    is_master boolean DEFAULT false
  );
  CREATE TABLE account_security.account_roles (
    profile_id uuid PRIMARY KEY REFERENCES public.users(id),
    role text NOT NULL,
    enabled boolean NOT NULL DEFAULT true
  );
  CREATE TABLE account_security.accounts (
    profile_id uuid PRIMARY KEY REFERENCES public.users(id),
    mapping_verified boolean NOT NULL DEFAULT true,
    status text NOT NULL DEFAULT 'active'
  );
  CREATE TABLE storage.buckets (
    id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
  );
  CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid(), bucket_id text, name text
  );
  CREATE FUNCTION storage.foldername(path text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
    SELECT string_to_array(path, '/')
  $$;
  CREATE FUNCTION public.current_profile_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
  CREATE FUNCTION public.is_current_profile(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
  CREATE FUNCTION public.is_current_staff() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
`);

let sql = await fs.readFile(new URL('../supabase/migrations/20260922040000_secure_direct_messages.sql', import.meta.url), 'utf8');
sql = sql.replace(/DO \$\$ BEGIN\s+ALTER PUBLICATION[\s\S]*?END \$\$;/m, '');
await db.exec(sql);
await db.exec(await fs.readFile(new URL('../supabase/migrations/20260923010000_allow_staff_direct_messages.sql', import.meta.url), 'utf8'));
await db.exec(await fs.readFile(new URL('../supabase/migrations/20260923020000_fix_direct_message_leave.sql', import.meta.url), 'utf8'));
await db.exec(await fs.readFile(new URL('../supabase/migrations/20260923021000_allow_student_only_group_after_staff_leave.sql', import.meta.url), 'utf8'));
await db.exec(await fs.readFile(new URL('../supabase/migrations/20260923022000_preserve_direct_message_titles.sql', import.meta.url), 'utf8'));
await db.exec(await fs.readFile(new URL('../supabase/migrations/20260923023000_create_dm_on_first_message.sql', import.meta.url), 'utf8'));
await db.exec(await fs.readFile(new URL('../supabase/migrations/20260923024000_direct_message_images.sql', import.meta.url), 'utf8'));

const required = ['dm_conversations', 'dm_participant_memberships', 'dm_messages', 'dm_message_reactions', 'dm_typing_states', 'dm_message_safety_archive', 'dm_conversation_reports'];
const result = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'dm_%'`);
const actual = new Set(result.rows.map(row => row.table_name));
for (const table of required) {
  if (!actual.has(table)) throw new Error(`missing table: ${table}`);
}

await db.exec(`
  CREATE OR REPLACE FUNCTION public.current_profile_id() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('app.test_profile', true), '')::uuid
  $$;
  CREATE OR REPLACE FUNCTION public.is_current_profile(profile_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT profile_id = public.current_profile_id()
  $$;
  CREATE OR REPLACE FUNCTION public.is_current_staff() RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT coalesce(current_setting('app.test_staff', true), 'false') = 'true'
  $$;
`);

const studentA = '00000000-0000-0000-0000-000000000001';
const studentB = '00000000-0000-0000-0000-000000000002';
const studentC = '00000000-0000-0000-0000-000000000003';
const staff = '00000000-0000-0000-0000-000000000010';
const staffB = '00000000-0000-0000-0000-000000000011';
await db.exec(`
  INSERT INTO public.users(id,name,status) VALUES
    ('${studentA}','학생A','active'), ('${studentB}','학생B','active'),
    ('${studentC}','학생C','active'), ('${staff}','스처쌤','active'), ('${staffB}','스처쌤B','active');
  INSERT INTO account_security.account_roles(profile_id,role,enabled) VALUES
    ('${studentA}','member',true), ('${studentB}','member',true),
    ('${studentC}','member',true), ('${staff}','admin',true), ('${staffB}','master',true);
  INSERT INTO account_security.accounts(profile_id) VALUES
    ('${studentA}'), ('${studentB}'), ('${studentC}'), ('${staff}'), ('${staffB}');
  SELECT set_config('app.test_profile','${studentA}',false), set_config('app.test_staff','false',false);
`);
let studentDirectBlocked = false;
try {
  await db.query(`SELECT public.dm_create_direct('${studentB}'::uuid)`);
} catch (error) {
  studentDirectBlocked = String(error?.message || error).includes('student_to_student_direct_not_allowed');
}
if (!studentDirectBlocked) throw new Error('student-to-student direct conversation was allowed');
const direct = (await db.query(`SELECT public.dm_create_direct('${staff}'::uuid) id`)).rows[0].id;
const preservedTitle = (await db.query(`SELECT display_title FROM public.dm_participant_memberships WHERE conversation_id='${direct}'::uuid AND user_id='${studentA}'::uuid`)).rows[0].display_title;
if (preservedTitle !== '스처쌤') throw new Error(`direct title was not preserved: ${preservedTitle}`);
await db.exec(`SELECT set_config('app.test_profile','${staff}',false), set_config('app.test_staff','true',false);`);
const startedGroup = (await db.query(`SELECT public.dm_start_conversation(ARRAY['${studentB}'::uuid,'${studentC}'::uuid], '첫 메시지와 함께 시작') id`)).rows[0].id;
const startedGroupMessages = Number((await db.query(`SELECT count(*) count FROM public.dm_messages WHERE conversation_id='${startedGroup}'::uuid AND message_type='TEXT'`)).rows[0].count);
if (startedGroupMessages !== 1) throw new Error('group was not created atomically with its first message');
const imageGroup = (await db.query(`SELECT public.dm_start_image_conversation(ARRAY['${studentB}'::uuid,'${studentC}'::uuid], '${staff}/test.jpg', 'image/jpeg') id`)).rows[0].id;
const imageMessage = (await db.query(`SELECT id FROM public.dm_messages WHERE conversation_id='${imageGroup}'::uuid AND message_type='IMAGE'`)).rows[0];
if (!imageMessage?.id) throw new Error('group was not created atomically with its first image');
await db.query(`SELECT public.dm_revoke_message(${imageMessage.id})`);
const archivedImage = (await db.query(`SELECT original_media_path FROM public.dm_message_safety_archive WHERE message_id=${imageMessage.id}`)).rows[0]?.original_media_path;
if (archivedImage !== `${staff}/test.jpg`) throw new Error('revoked image path was not preserved for safety reports');
const staffDirect = (await db.query(`SELECT public.dm_create_direct('${staffB}'::uuid) id`)).rows[0].id;
const repeatedStaffDirect = (await db.query(`SELECT public.dm_create_direct('${staffB}'::uuid) id`)).rows[0].id;
if (staffDirect !== repeatedStaffDirect) throw new Error('staff direct conversation was duplicated');
await db.query(`SELECT public.dm_leave_conversation('${staffDirect}'::uuid)`);
const staffDirectStatus = (await db.query(`SELECT status FROM public.dm_conversations WHERE id='${staffDirect}'::uuid`)).rows[0].status;
if (staffDirectStatus !== 'ARCHIVED') throw new Error('one-person staff direct conversation remained active after leave');
const studentOnlyGroup = (await db.query(`SELECT public.dm_create_group('${direct}'::uuid, ARRAY['${studentB}'::uuid], '학생 유지 그룹') id`)).rows[0].id;
await db.query(`SELECT public.dm_leave_conversation('${studentOnlyGroup}'::uuid)`);
const studentOnlyStatus = (await db.query(`SELECT status FROM public.dm_conversations WHERE id='${studentOnlyGroup}'::uuid`)).rows[0].status;
if (studentOnlyStatus !== 'ACTIVE') throw new Error('student-only group was archived after staff left');
await db.exec(`SELECT set_config('app.test_profile','${studentA}',false), set_config('app.test_staff','false',false);`);
await db.query(`SELECT public.dm_send_message('${studentOnlyGroup}'::uuid, '학생끼리 이어지는 대화')`);
let studentInviteBlocked = false;
try { await db.query(`SELECT public.dm_invite_participant('${studentOnlyGroup}'::uuid, '${studentC}'::uuid)`); }
catch (error) { studentInviteBlocked = String(error?.message || error).includes('staff_membership_required'); }
if (!studentInviteBlocked) throw new Error('student invited a participant to a group');
await db.exec(`SELECT set_config('app.test_profile','${staff}',false), set_config('app.test_staff','true',false);`);
const group = (await db.query(`SELECT public.dm_create_group('${direct}'::uuid, ARRAY['${studentB}'::uuid], '테스트 그룹') id`)).rows[0].id;
const firstMessage = (await db.query(`SELECT (public.dm_send_message('${group}'::uuid, '초대 전 메시지')).id id`)).rows[0].id;
await db.query(`SELECT public.dm_invite_participant('${group}'::uuid, '${studentC}'::uuid)`);
await db.exec(`SELECT set_config('app.test_profile','${studentC}',false), set_config('app.test_staff','false',false);`);
const canReadEarlier = (await db.query(`SELECT public.dm_can_read_message(${firstMessage}) allowed`)).rows[0].allowed;
if (canReadEarlier) throw new Error('late participant can read earlier messages');
const laterMessage = (await db.query(`SELECT (public.dm_send_message('${group}'::uuid, '초대 후 메시지')).id id`)).rows[0].id;
await db.query(`SELECT public.dm_toggle_reaction(${laterMessage}, '👍')`);
await db.query(`SELECT public.dm_toggle_reaction(${laterMessage}, '❤️')`);
const reactionCount = Number((await db.query(`SELECT count(*) count FROM public.dm_message_reactions WHERE message_id = ${laterMessage}`)).rows[0].count);
if (reactionCount !== 2) throw new Error(`expected two reactions, found ${reactionCount}`);
await db.query(`SELECT public.dm_leave_conversation('${group}'::uuid)`);
const stillActive = (await db.query(`SELECT public.dm_is_active_member('${group}'::uuid, '${studentC}'::uuid) active`)).rows[0].active;
if (stillActive) throw new Error('left participant is still active');
await db.exec(`SELECT set_config('app.test_profile','${studentB}',false), set_config('app.test_staff','false',false);`);
const cancellable = (await db.query(`SELECT (public.dm_send_message('${group}'::uuid, '신고 보존 확인')).id id`)).rows[0].id;
await db.query(`SELECT public.dm_revoke_message(${cancellable})`);
const reportId = (await db.query(`SELECT public.dm_report_conversation('${group}'::uuid) id`)).rows[0].id;
const reportSnapshot = (await db.query(`SELECT message_snapshot FROM public.dm_conversation_reports WHERE id = '${reportId}'`)).rows[0].message_snapshot;
if (!JSON.stringify(reportSnapshot).includes('신고 보존 확인')) throw new Error('report did not preserve revoked content');
await db.exec(`SELECT set_config('app.test_profile','${staff}',false), set_config('app.test_staff','false',false);`);
const revokedStaffAccess = (await db.query(`SELECT public.dm_is_active_member('${group}'::uuid, '${staff}'::uuid) active`)).rows[0].active;
if (revokedStaffAccess) throw new Error('revoked staff still has DM access');

console.log(`direct-message migration and core flows passed; ${required.length} required tables found`);
await db.close();
