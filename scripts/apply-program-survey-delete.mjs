import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {connectCommunityDb,communityProject} from './community-db.mjs';
const version='20261023020000',name='program_survey_delete_cleanup',apply=process.argv.includes('--apply');
const sql=(await readFile(`supabase/migrations/${version}_${name}.sql`,'utf8')).replace(/^BEGIN;|^COMMIT;/gm,'');const sha256=createHash('sha256').update(sql).digest('hex');
const root='artifacts/program-survey-delete';await mkdir(root,{recursive:true});const db=await connectCommunityDb();
const counts=async()=>(await db.query('SELECT (SELECT count(*) FROM notices) notices,(SELECT count(*) FROM survey_forms) forms,(SELECT count(*) FROM survey_versions) versions,(SELECT count(*) FROM survey_links) links,(SELECT count(*) FROM survey_entries) entries,(SELECT count(*) FROM logs) logs')).rows[0];
try{await db.query('BEGIN');await db.query('SET LOCAL ROLE postgres');await db.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s'");
assert.equal((await db.query('SELECT count(*)::int n FROM supabase_migrations.schema_migrations WHERE version=$1',[version])).rows[0].n,0);
assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='cleanup_deleted_notice_surveys'")).rows[0].n,0);
const before=await counts();
const constraints=(await db.query("SELECT conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='public.survey_forms'::regclass AND contype='c'")).rows;
assert.ok(!constraints.some(c=>/owner_notice_id.*IS NOT NULL/i.test(c.definition)),'unexpected required owner');
const triggers=(await db.query("SELECT tgname,pg_get_triggerdef(oid) definition FROM pg_trigger WHERE tgrelid IN ('public.survey_forms'::regclass,'public.survey_entries'::regclass,'public.survey_links'::regclass) AND NOT tgisinternal")).rows;
await writeFile(root+'/rollback.sql',`BEGIN;\nDROP TRIGGER IF EXISTS cleanup_surveys_before_notice_delete ON public.notices;\nDROP FUNCTION IF EXISTS public.cleanup_deleted_notice_surveys();\nCOMMIT;\n`);
await db.query(sql);assert.deepEqual(await counts(),before);
const permissions=(await db.query("SELECT NOT has_function_privilege('anon','public.cleanup_deleted_notice_surveys()','EXECUTE') anon_denied,NOT has_function_privilege('authenticated','public.cleanup_deleted_notice_surveys()','EXECUTE') authenticated_denied")).rows[0];assert.ok(Object.values(permissions).every(Boolean));
if(apply){const dry=JSON.parse(await readFile(root+'/dry-run.json','utf8'));assert.equal(dry.sha256,sha256);assert.equal(dry.project,communityProject);await db.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',[version,name,[sql]]);}
await db.query(apply?'COMMIT':'ROLLBACK');const result={status:apply?'applied':'dry_run_passed',project:communityProject,sha256,before,permissions,constraints,triggers,existingRecordsChanged:false};await writeFile(root+'/'+(apply?'applied':'dry-run')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,project:communityProject,before,permissions,existingRecordsChanged:false}));
}catch(e){await db.query('ROLLBACK').catch(()=>{});console.error(e.message);process.exitCode=1}finally{await db.end()}
