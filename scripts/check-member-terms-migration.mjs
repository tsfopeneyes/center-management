import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { TERMS_VERSION } from '../src/constants/appConstants.js';

const project=(await readFile('supabase/.temp/project-ref','utf8')).trim();
if(project!=='erecqalsxoxrufggvmcc')throw new Error('Unexpected linked project');
const dry=execFileSync(process.env.ComSpec||'C:\\Windows\\System32\\cmd.exe',
  ['/d','/s','/c','npx supabase db dump --linked --schema public --dry-run'],
  {encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:2_000_000});
const value=name=>dry.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
const client=new pg.Client({host:value('PGHOST'),port:Number(value('PGPORT')),user:value('PGUSER'),password:value('PGPASSWORD'),database:value('PGDATABASE'),
  ssl:{ca:await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt','utf8'),rejectUnauthorized:true},connectionTimeoutMillis:10000,application_name:'rollback-only-member-terms-check'});
let sql=await readFile('supabase/migrations/20260928020000_member_terms_consent_history.sql','utf8');
sql=sql.replace(/^\s*BEGIN;\s*/i,'').replace(/\s*COMMIT;\s*$/i,'');
assert.match(sql,new RegExp(`p_terms_version<>'${TERMS_VERSION}'`));
try{
  await client.connect();await client.query('BEGIN');await client.query('SET LOCAL ROLE postgres');await client.query("SET LOCAL lock_timeout='3s'");await client.query(sql);
  const {rows:[check]}=await client.query(`SELECT
    to_regclass('account_security.member_terms_consents') IS NOT NULL AS history_table,
    to_regprocedure('public.accept_kiosk_member_terms(uuid,text)') IS NOT NULL AS kiosk_function,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='guard_member_terms_preferences' AND NOT tgisinternal) AS guard_trigger,
    (SELECT count(*) FROM account_security.member_terms_consents WHERE source='LEGACY_PREFERENCE') =
      (SELECT count(*) FROM public.users WHERE preferences->>'terms_agreed'='true' AND length(COALESCE(preferences->>'terms_version','')) BETWEEN 1 AND 80) AS exact_backfill`);
  assert.deepEqual(check,{history_table:true,kiosk_function:true,guard_trigger:true,exact_backfill:true});
  const {rows:[fixture]}=await client.query(`SELECT id FROM public.users WHERE status IS DISTINCT FROM 'withdrawn' LIMIT 1`);
  assert.ok(fixture?.id);
  await client.query('SET LOCAL ROLE account_profile_worker');
  await client.query("SELECT set_config('app.profile_id',$1,true)",[fixture.id]);
  await client.query(`INSERT INTO account_security.member_terms_consents(
    profile_id,terms_version,source,art1,art2,art3,art4,accepted_at)
    VALUES($1,'fixture-rollback-profile','WEB_LOGIN',true,true,true,true,clock_timestamp())
    ON CONFLICT(profile_id,terms_version) DO NOTHING`,[fixture.id]);
  await client.query('SET LOCAL ROLE account_membership_worker');
  await client.query(`INSERT INTO account_security.member_terms_consents(
    profile_id,terms_version,source,art1,art2,art3,art4,accepted_at)
    VALUES($1,'fixture-rollback-signup','SIGNUP',true,true,true,true,clock_timestamp())
    ON CONFLICT(profile_id,terms_version) DO NOTHING`,[fixture.id]);
  await client.query('SET LOCAL ROLE postgres');
  await client.query('ROLLBACK');
  console.log('PASS member terms migration: rollback-only DDL, exact legacy evidence, private history, kiosk function and overwrite guard');
}catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{await client.end();}
