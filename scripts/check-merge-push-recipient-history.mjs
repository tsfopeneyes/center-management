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
  connectionTimeoutMillis:10000,application_name:'merge-push-recipient-check'});
let active=false;
try{
  await client.connect();await client.query(mode==='--verify'?'BEGIN READ ONLY':'BEGIN');active=true;
  await client.query('SET LOCAL ROLE postgres');await client.query("SET LOCAL statement_timeout='45s'");
  const version='20260921040000',name='merge_push_recipient_history';
  const recorded=await client.query('SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1',[version]);
  const full=await readFile('supabase/migrations/20260921040000_merge_push_recipient_history.sql','utf8');
  const sql=full.replace(/^\s*BEGIN\s*;/i,'').replace(/COMMIT\s*;\s*$/i,'');
  if(mode!=='--verify')await client.query(sql);
  const access=(await client.query(`SELECT
    has_column_privilege('account_merge_worker','public.push_dispatch_recipients','user_id','UPDATE') AS can_update,
    has_table_privilege('account_merge_worker','public.push_dispatch_recipients','DELETE') AS can_delete`)).rows[0];
  const policy=Number((await client.query(`SELECT count(*)::int AS count FROM pg_policies WHERE schemaname='public'
    AND tablename='push_dispatch_recipients' AND policyname IN
      ('account_merge_push_dispatch_recipients','account_merge_delete_duplicate_push_recipient')`)).rows[0].count);
  let relinked=null;
  if(mode!=='--verify'){
    await client.query('SET LOCAL ROLE account_merge_worker');
    await client.query("SELECT set_config('app.merge_source_id',$1,true)",['1305c295-acbb-4664-b904-ca9b92be7c20']);
    await client.query("SELECT set_config('app.merge_target_id',$1,true)",['1759a347-d3f6-46fc-9184-6b2311612700']);
    await client.query(`DELETE FROM public.push_dispatch_recipients source USING public.push_dispatch_recipients target
      WHERE source.user_id=$1 AND target.user_id=$2 AND target.dispatch_id=source.dispatch_id`,
      ['1305c295-acbb-4664-b904-ca9b92be7c20','1759a347-d3f6-46fc-9184-6b2311612700']);
    relinked=(await client.query(`UPDATE public.push_dispatch_recipients SET user_id=$2 WHERE user_id=$1 RETURNING dispatch_id`,
      ['1305c295-acbb-4664-b904-ca9b92be7c20','1759a347-d3f6-46fc-9184-6b2311612700'])).rowCount;
    await client.query('RESET ROLE');
  }
  console.log(JSON.stringify({recorded:recorded.rows.length===1,...access,policy,relinked}));
  if(!access.can_update||!access.can_delete||policy!==2)throw new Error('Push recipient merge access missing');
  if(mode==='--apply'){
    if(recorded.rows.length)throw new Error('Migration already recorded');
    await client.query('SET LOCAL ROLE postgres');
    await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',[version,name,[sql]]);
    await client.query('COMMIT');active=false;
  }else{await client.query('ROLLBACK');active=false;}
}catch(error){if(active)await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({message:error.message,code:error.code,detail:error.detail}));process.exitCode=1;}
finally{await client.end();}
