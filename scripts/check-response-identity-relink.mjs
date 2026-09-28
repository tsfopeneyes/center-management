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
  connectionTimeoutMillis:10000,application_name:'response-identity-relink-check'});
let active=false;
try{
  await client.connect();await client.query(mode==='--verify'?'BEGIN READ ONLY':'BEGIN');active=true;
  await client.query('SET LOCAL ROLE postgres');await client.query("SET LOCAL statement_timeout='45s'");
  const version='20260921030000',name='allow_response_identity_relink';
  const recorded=await client.query('SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1',[version]);
  const full=await readFile('supabase/migrations/20260921030000_allow_response_identity_relink.sql','utf8');
  const sql=full.replace(/^\s*BEGIN\s*;/i,'').replace(/COMMIT\s*;\s*$/i,'');
  if(mode!=='--verify')await client.query(sql);
  const definition=(await client.query(`SELECT pg_get_functiondef('public.guard_program_recruitment_response()'::regprocedure) AS value`)).rows[0].value;
  const fixed=!definition.includes('NEW.user_id IS NOT DISTINCT FROM OLD.user_id');
  let relinked=null;
  if(mode!=='--verify'){
    await client.query('SET LOCAL ROLE account_merge_worker');
    await client.query("SELECT set_config('app.merge_source_id',$1,true)",['f846eaae-8791-4106-8c9d-1d4ce61a849e']);
    await client.query("SELECT set_config('app.merge_target_id',$1,true)",['5adf41e6-e3fd-4e2a-b789-5e04ff992d97']);
    relinked=(await client.query(`UPDATE public.notice_responses SET user_id=$2 WHERE user_id=$1 RETURNING notice_id`,
      ['f846eaae-8791-4106-8c9d-1d4ce61a849e','5adf41e6-e3fd-4e2a-b789-5e04ff992d97'])).rowCount;
    await client.query('RESET ROLE');
  }
  console.log(JSON.stringify({recorded:recorded.rows.length===1,fixed,relinked}));
  if(!fixed)throw new Error('Trigger still blocks identity-only updates');
  if(mode==='--apply'){
    if(recorded.rows.length)throw new Error('Migration already recorded');
    await client.query('SET LOCAL ROLE postgres');
    await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',[version,name,[sql]]);
    await client.query('COMMIT');active=false;
  }else{await client.query('ROLLBACK');active=false;}
}catch(error){if(active)await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({message:error.message,code:error.code,detail:error.detail}));process.exitCode=1;}
finally{await client.end();}
