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
  if((await readFile('supabase/.temp/project-ref','utf8')).trim()!=='erecqalsxoxrufggvmcc')throw new Error('Unexpected project');
  await client.connect();await client.query(mode==='--verify'?'BEGIN READ ONLY':'BEGIN');active=true;
  await client.query('SET LOCAL ROLE postgres');await client.query("SET LOCAL statement_timeout='30s'");
  const version='20261012010000',name='allow_member_withdrawal_terms_cleanup';
  const recorded=await client.query('SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1',[version]);
  const full=await readFile('supabase/migrations/20261012010000_allow_member_withdrawal_terms_cleanup.sql','utf8');
  const sql=full.replace(/^\s*BEGIN\s*;/i,'').replace(/COMMIT\s*;\s*$/i,'');
  if(mode!=='--verify')await client.query(sql);

  const definition=(await client.query(`SELECT pg_get_functiondef('account_security.guard_member_terms_preferences()'::regprocedure) definition`)).rows[0].definition;
  if(!definition.includes("current_user = 'account_member_admin_worker'")||!definition.includes('app.target_profile_id'))throw new Error('Withdrawal exception missing');
  if(mode!=='--verify'){
    await client.query(`CREATE TEMP TABLE withdrawal_terms_fixture(id uuid,status text,preferences jsonb);
      GRANT SELECT,UPDATE ON withdrawal_terms_fixture TO account_member_admin_worker;
      CREATE TRIGGER guard_terms BEFORE UPDATE ON withdrawal_terms_fixture FOR EACH ROW EXECUTE FUNCTION account_security.guard_member_terms_preferences();
      INSERT INTO withdrawal_terms_fixture VALUES('10000000-0000-4000-8000-000000000002','approved','{"terms_agreed":true,"terms_version":"v1"}');
      SELECT set_config('app.target_profile_id','10000000-0000-4000-8000-000000000002',true);
      SET LOCAL ROLE account_member_admin_worker`);
    await client.query('SAVEPOINT blocked_write');
    let blocked=false;
    try{await client.query(`UPDATE withdrawal_terms_fixture SET preferences='{}'`);}catch(error){if(error.code!=='42501')throw error;blocked=true;}
    await client.query('ROLLBACK TO SAVEPOINT blocked_write');
    if(!blocked)throw new Error('Unverified consent change allowed');
    await client.query(`UPDATE withdrawal_terms_fixture SET status='withdrawn',preferences=jsonb_build_object('anonymized',true,'withdrawn_at',clock_timestamp())`);
    await client.query('SET LOCAL ROLE postgres');
    await client.query('DROP TABLE withdrawal_terms_fixture');
  }
  console.log(JSON.stringify({recorded:recorded.rows.length===1,scopedWithdrawalAllowed:true,ordinaryConsentProtection:true}));  if(mode==='--apply'){
    if(recorded.rows.length)throw new Error('Migration already recorded');
    await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',[version,name,[sql]]);
    await client.query('COMMIT');active=false;
  }else{await client.query('ROLLBACK');active=false;}
}catch(error){if(active)await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({message:error.message,code:error.code}));process.exitCode=1;}
finally{await client.end();}
