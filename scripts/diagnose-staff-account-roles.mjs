import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

const output=execFileSync(process.env.ComSpec||'C:\\Windows\\System32\\cmd.exe',
  ['/d','/s','/c','npx supabase db dump --linked --schema public --dry-run'],
  {encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:2_000_000});
const secret=name=>output.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
const client=new pg.Client({host:secret('PGHOST'),port:Number(secret('PGPORT')),user:secret('PGUSER'),password:secret('PGPASSWORD'),
  database:secret('PGDATABASE'),ssl:{ca:await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt','utf8'),rejectUnauthorized:true},
  connectionTimeoutMillis:10000,application_name:'diagnose-staff-account-roles'});
try{
  await client.connect();await client.query('BEGIN READ ONLY');await client.query('SET LOCAL ROLE postgres');
  const {rows}=await client.query(`SELECT u.id,u.name,u.phone,u.user_group,u.status,u.role AS display_role,
      a.status AS account_status,a.mapping_verified,r.role AS account_role,r.enabled
    FROM public.users u
    LEFT JOIN account_security.accounts a ON a.profile_id=u.id
    LEFT JOIN account_security.account_roles r ON r.profile_id=u.id
    WHERE lower(u.name) IN ('jin','rok','admin') OR (r.enabled AND r.role IN ('admin','master'))
    ORDER BY r.role DESC,u.name,u.id`);
  console.log(JSON.stringify(rows,null,2));await client.query('ROLLBACK');
}finally{await client.end();}
