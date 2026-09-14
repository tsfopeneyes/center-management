// Read-only production preflight. Never executes the proposed migration.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
const command = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
const dryRun = execFileSync(command, ['/d','/s','/c','npx supabase db dump --linked --schema public --dry-run'], { encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:2_000_000 });
const value = name => dryRun.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE'].some(name=>!value(name))) throw new Error('Linked database credentials unavailable');
const ca = await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt','utf8');
const client = new pg.Client({host:value('PGHOST'),port:Number(value('PGPORT')),user:value('PGUSER'),password:value('PGPASSWORD'),database:value('PGDATABASE'),ssl:{ca,rejectUnauthorized:true},connectionTimeoutMillis:10000,application_name:'unified-survey-readonly-preflight'});
try {
 await client.connect();
 await client.query('BEGIN READ ONLY');
 await client.query("SET LOCAL statement_timeout='10s'");
 const columns = await client.query(`WITH columns AS (SELECT c.relname AS table_name,a.attname AS column_name,format_type(a.atttypid,a.atttypmod) AS data_type FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped) SELECT table_name,column_name,data_type FROM columns WHERE
  ((table_name='notices' AND column_name IN ('id','program_date','program_end_date','program_end_time','program_duration','program_status','haifn_reward','is_review_required','guest_properties')) OR
   (table_name IN ('users','logs','locations') AND column_name IN ('id','user_id','location_id','type','name','created_at')) OR
   (table_name='notice_responses' AND column_name IN ('user_id','notice_id','status','is_attended')) OR
   (table_name='haifn_transactions' AND column_name IN ('user_id','amount','transaction_type','source_description')) OR
   (table_name='program_feedback' AND column_name IN ('q3_satisfaction','q6_would_rejoin'))) ORDER BY table_name,column_name`);
 await client.query('SAVEPOINT count_check');
 let counts = { rows: [] }, countAccess = 'allowed';
 try { counts = await client.query(`SELECT (SELECT count(*) FROM public.surveys)::int surveys,(SELECT count(*) FROM public.survey_assignments)::int assignments,(SELECT count(*) FROM public.checkin_surveys)::int visit_responses,(SELECT count(*) FROM public.program_feedback)::int program_responses,(SELECT count(*) FROM public.visit_notes)::int visit_notes`); }
 catch (error) { if (error.code !== '42501') throw error; countAccess='denied; no role escalation attempted'; await client.query('ROLLBACK TO SAVEPOINT count_check'); }
 const functions = await client.query(`SELECT proname FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace WHERE n.nspname='public' AND proname IN ('is_current_staff','is_current_profile') ORDER BY proname`);
 const policies = await client.query(`SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('logs','checkin_surveys','program_feedback') ORDER BY tablename,policyname`);
 const conflicts = await client.query(`SELECT c.relname AS table_name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('survey_forms','survey_versions','survey_links','survey_entries')`);
 await client.query('ROLLBACK');
 console.log(JSON.stringify({readOnly:true,countAccess,counts:counts.rows[0],columns:columns.rows,functions:functions.rows,existingNewTables:conflicts.rows,policies:policies.rows},null,2));
} finally { await client.end(); }
