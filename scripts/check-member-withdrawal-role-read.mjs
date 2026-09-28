import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

const mode=process.argv[2]||'--dry-run';
if(!['--dry-run','--apply','--verify'].includes(mode))throw new Error('Use --dry-run, --apply, or --verify');
const output=execFileSync(process.env.ComSpec||'C:\\Windows\\System32\\cmd.exe',
  ['/d','/s','/c','npx supabase db dump --linked --schema public --dry-run'],
  {encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:2_000_000});
const secret=name=>output.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
const client=new pg.Client({host:secret('PGHOST'),port:Number(secret('PGPORT')),user:secret('PGUSER'),password:secret('PGPASSWORD'),
  database:secret('PGDATABASE'),ssl:{ca:await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt','utf8'),rejectUnauthorized:true},
  connectionTimeoutMillis:10000,application_name:'member-withdrawal-role-read-check'});
let active=false;
try{
  await client.connect();await client.query(mode==='--verify'?'BEGIN READ ONLY':'BEGIN');active=true;
  await client.query('SET LOCAL ROLE postgres');await client.query("SET LOCAL statement_timeout='30s'");
  const version='20260922030000',name='fix_member_withdrawal_role_read';
  const recorded=await client.query('SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1',[version]);
  const full=await readFile('supabase/migrations/20260922030000_fix_member_withdrawal_role_read.sql','utf8');
  const sql=full.replace(/^\s*BEGIN\s*;/i,'').replace(/COMMIT\s*;\s*$/i,'');
  if(mode!=='--verify')await client.query(sql);
  const policies=(await client.query(`SELECT policyname,cmd,qual FROM pg_policies
    WHERE schemaname='account_security' AND tablename='account_roles' AND policyname='member_admin_role_read'`)).rows;
  if(policies.length!==1||policies[0].cmd!=='SELECT'||!policies[0].qual.includes('app.actor_profile_id')||!policies[0].qual.includes('app.target_profile_id'))
    throw new Error('Scoped member role read policy missing');
  console.log(JSON.stringify({recorded:recorded.rows.length===1,policy:policies[0]}));
  if(mode==='--apply'){
    if(recorded.rows.length)throw new Error('Migration already recorded');
    await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',[version,name,[sql]]);
    await client.query('COMMIT');active=false;
  }else{await client.query('ROLLBACK');active=false;}
}catch(error){if(active)await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({message:error.message,code:error.code}));process.exitCode=1;}
finally{await client.end();}
