import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

const searchName=process.argv[2]?.trim();
if(!searchName)throw new Error('Usage: node scripts/diagnose-guest-merge-blocker.mjs <name>');
const output=execFileSync(process.env.ComSpec||'C:\\Windows\\System32\\cmd.exe',
  ['/d','/s','/c','npx supabase db dump --linked --schema public --dry-run'],
  {encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:2_000_000});
const secret=name=>output.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if(['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE'].some(name=>!secret(name)))throw new Error('Linked credentials unavailable');
const client=new pg.Client({host:secret('PGHOST'),port:Number(secret('PGPORT')),user:secret('PGUSER'),
  password:secret('PGPASSWORD'),database:secret('PGDATABASE'),
  ssl:{ca:await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt','utf8'),rejectUnauthorized:true},
  connectionTimeoutMillis:10000,application_name:'diagnose-guest-merge-blocker'});
const ident=value=>'"'+String(value).replaceAll('"','""')+'"';
try{
  await client.connect();
  await client.query('BEGIN READ ONLY');
  await client.query('SET LOCAL ROLE postgres');
  await client.query("SET LOCAL statement_timeout='30s'");
  const profiles=(await client.query(`SELECT u.id,u.name,u.phone,u.user_group,u.preferences,u.auth_user_id,
      a.status AS account_status,r.role AS account_role,r.enabled AS account_role_enabled
    FROM public.users u LEFT JOIN account_security.accounts a ON a.profile_id=u.id
    LEFT JOIN account_security.account_roles r ON r.profile_id=u.id
    WHERE u.name ILIKE $1 ORDER BY u.created_at NULLS LAST,u.id`,[`%${searchName}%`])).rows;
  const refs=(await client.query(`SELECT c.relname AS table_name,a.attname AS column_name,
      has_table_privilege('account_merge_worker',c.oid,'SELECT') AS can_select,
      has_table_privilege('account_merge_worker',c.oid,'UPDATE') AS can_update
    FROM pg_constraint fk JOIN pg_class c ON c.oid=fk.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=fk.conkey[1]
    WHERE fk.contype='f' AND fk.confrelid='public.users'::regclass AND n.nspname='public'
      AND cardinality(fk.conkey)=1 AND cardinality(fk.confkey)=1 ORDER BY c.relname,a.attname`)).rows;
  const result=[];
  for(const profile of profiles){
    const activity=[];
    for(const ref of refs){
      const count=Number((await client.query(`SELECT count(*)::int AS count FROM public.${ident(ref.table_name)}
        WHERE ${ident(ref.column_name)}=$1`,[profile.id])).rows[0].count);
      if(count)activity.push({...ref,count});
    }
    result.push({profile,activity});
  }
  console.log(JSON.stringify({profiles:result},null,2));
  await client.query('ROLLBACK');
}finally{await client.end();}
