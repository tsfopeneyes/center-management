import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

const apply=process.argv[2]==='--apply';
const verify=process.argv[2]==='--verify';
if(process.argv.length>3 || (process.argv[2] && !['--apply','--dry-run','--verify'].includes(process.argv[2])))
  throw new Error('Use --dry-run, --apply, or --verify');
const project=(await readFile('supabase/.temp/project-ref','utf8')).trim();
if(project!=='erecqalsxoxrufggvmcc')throw new Error('Unexpected linked project');
const output=execFileSync(process.env.ComSpec||'C:\\Windows\\System32\\cmd.exe',
  ['/d','/s','/c','npx supabase db dump --linked --schema public --dry-run'],
  {encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:2_000_000});
const secret=name=>output.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if(['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE'].some(name=>!secret(name)))throw new Error('Linked credentials unavailable');
const client=new pg.Client({host:secret('PGHOST'),port:Number(secret('PGPORT')),user:secret('PGUSER'),
  password:secret('PGPASSWORD'),database:secret('PGDATABASE'),
  ssl:{ca:await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt','utf8'),rejectUnauthorized:true},
  connectionTimeoutMillis:10000,application_name:'guest-merge-migration-check'});
let active=false;
try{
  await client.connect();await client.query(verify?'BEGIN READ ONLY':'BEGIN');active=true;
  await client.query('SET LOCAL ROLE postgres');
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query("SET LOCAL statement_timeout='45s'");
  const version='20260921010000';
  const name='guest_merge_audit_read_access';
  const recorded=await client.query('SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1',[version]);
  if(!verify&&recorded.rows.length)throw new Error('Migration already recorded');
  const sql=await readFile('supabase/migrations/20260921010000_guest_merge_audit_read_access.sql','utf8');
  const before=await client.query(`SELECT count(*) FILTER(WHERE NOT has_table_privilege('account_merge_worker',c.oid,'SELECT'))::int AS missing
    FROM pg_constraint fk JOIN pg_class c ON c.oid=fk.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE fk.contype='f' AND fk.confrelid='public.users'::regclass AND n.nspname='public'
      AND cardinality(fk.conkey)=1 AND cardinality(fk.confkey)=1`);
  if(!verify)await client.query(sql);
  const after=await client.query(`SELECT count(*) FILTER(WHERE NOT has_table_privilege('account_merge_worker',c.oid,'SELECT'))::int AS missing
    FROM pg_constraint fk JOIN pg_class c ON c.oid=fk.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE fk.contype='f' AND fk.confrelid='public.users'::regclass AND n.nspname='public'
      AND cardinality(fk.conkey)=1 AND cardinality(fk.confkey)=1`);
  console.log(JSON.stringify({recorded:recorded.rows.length===1,missingBefore:before.rows[0].missing,missingAfter:after.rows[0].missing}));
  if(after.rows[0].missing!==0)throw new Error('Merge audit read permissions still missing');
  if(verify&&recorded.rows.length!==1)throw new Error('Migration record missing');
  if(apply)await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',
    [version,name,[sql]]);
  await client.query(apply?'COMMIT':'ROLLBACK');active=false;
  console.log(apply?'Read-only merge audit permissions applied.':verify?'Persisted migration verified.':'Production dry-run rolled back.');
}catch(error){if(active)await client.query('ROLLBACK').catch(()=>{});
  console.error(JSON.stringify({message:error.message,code:error.code,detail:error.detail}));process.exitCode=1;
}finally{await client.end();}
