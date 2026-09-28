import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

const mode=process.argv[2]||'--dry-run';
if(!['--dry-run','--apply','--verify'].includes(mode))throw new Error('Use --dry-run, --apply, or --verify');
const project=(await readFile('supabase/.temp/project-ref','utf8')).trim();
if(project!=='erecqalsxoxrufggvmcc')throw new Error('Unexpected linked project');
const output=execFileSync(process.env.ComSpec||'C:\\Windows\\System32\\cmd.exe',
  ['/d','/s','/c','npx supabase db dump --linked --schema public --dry-run'],
  {encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:2_000_000});
const secret=name=>output.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
const client=new pg.Client({host:secret('PGHOST'),port:Number(secret('PGPORT')),user:secret('PGUSER'),
  password:secret('PGPASSWORD'),database:secret('PGDATABASE'),
  ssl:{ca:await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt','utf8'),rejectUnauthorized:true},
  connectionTimeoutMillis:10000,application_name:'member-role-registration-fix'});
let active=false;
try{
  await client.connect();await client.query(mode==='--verify'?'BEGIN READ ONLY':'BEGIN');active=true;
  await client.query('SET LOCAL ROLE postgres');await client.query("SET LOCAL statement_timeout='45s'");
  const version='20260921020000',name='create_member_role_during_registration';
  const recorded=await client.query('SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1',[version]);
  const missing=()=>client.query(`SELECT count(*)::int AS count FROM account_security.accounts a
    JOIN public.users u ON u.id=a.profile_id LEFT JOIN account_security.account_roles r ON r.profile_id=a.profile_id
    WHERE r.profile_id IS NULL AND a.mapping_verified AND a.status='active' AND u.role='user'
      AND NOT COALESCE(u.is_master,false) AND u.user_group IN ('청소년','졸업생')`);
  const before=Number((await missing()).rows[0].count);
  const migrationSql=(await readFile('supabase/migrations/20260921020000_create_member_role_during_registration.sql','utf8'))
    .replace(/^\s*BEGIN\s*;/i,'').replace(/COMMIT\s*;\s*$/i,'');
  if(mode!=='--verify')await client.query(migrationSql);
  const after=Number((await missing()).rows[0].count);
  const privilege=(await client.query(`SELECT has_table_privilege('account_membership_worker','account_security.account_roles','INSERT') AS ok`)).rows[0].ok;
  const policy=(await client.query(`SELECT count(*)::int AS count FROM pg_policies WHERE schemaname='account_security'
    AND tablename='account_roles' AND policyname='membership_role_insert'`)).rows[0].count;
  const park=(await client.query(`SELECT r.role,r.enabled FROM account_security.account_roles r
    JOIN public.users u ON u.id=r.profile_id WHERE u.name='박성경' AND u.birth='080208' AND u.user_group='청소년'`)).rows;
  console.log(JSON.stringify({recorded:recorded.rows.length===1,before,after,privilege,policy,park}));
  if(mode!=='--verify'&&(after!==0||!privilege||policy!==1||park.length!==1||park[0].role!=='member'||park[0].enabled!==true))
    throw new Error('Migration validation failed');
  if(mode==='--apply'){
    if(recorded.rows.length)throw new Error('Migration already recorded');
    await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',[version,name,[migrationSql]]);
    await client.query('COMMIT');active=false;
  }else{await client.query('ROLLBACK');active=false;}
}catch(error){if(active)await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({message:error.message,code:error.code}));process.exitCode=1;}
finally{await client.end();}
