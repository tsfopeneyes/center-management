import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const apply = process.argv[2] === '--apply';
if (process.argv.length > 3 || (process.argv[2] && !['--apply', '--dry-run'].includes(process.argv[2])))
  throw new Error('Usage: node scripts/apply-challenge-feature-migrations.mjs [--dry-run|--apply]');
const migrations = ['20261001090000_welcome_qr_visits.sql'];
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
if (project !== 'erecqalsxoxrufggvmcc') throw new Error('Unexpected linked project');
const dry = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
  ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000 });
const value = name => dry.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !value(name)))
  throw new Error('Linked credentials unavailable');
const client = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')),
  user: value('PGUSER'), password: value('PGPASSWORD'), database: value('PGDATABASE'),
  ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
  connectionTimeoutMillis: 10000, application_name: apply ? 'challenge-feature-migrations' : 'challenge-feature-migration-dry-run' });
let inTransaction = false;
try {
  await client.connect();
  await client.query('BEGIN');
  inTransaction = true;
  await client.query('SET LOCAL ROLE postgres');
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL statement_timeout = '45s'");
  for (const filename of migrations) {
    console.log(`Checking ${filename}`);
    const version = filename.slice(0, 14);
    const name = filename.slice(15, -4);
    const { rows } = await client.query('SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1', [version]);
    if (rows.length) throw new Error(`Already applied: ${filename}`);
    const sql = (await readFile(`supabase/migrations/${filename}`, 'utf8')).replace(/^BEGIN;|^COMMIT;/gm, '');
    await client.query(sql);
    await client.query('SAVEPOINT qr_verification');
    await client.query('SET LOCAL ROLE anon');
    await client.query("INSERT INTO public.welcome_qr_visits(browser_token) VALUES ('00000000-0000-4000-8000-000000000001')");
    await client.query('SET LOCAL ROLE postgres');
    const { rows: [access] } = await client.query("SELECT has_table_privilege('anon','public.welcome_qr_visits','SELECT') AS can_read, has_table_privilege('anon','public.welcome_qr_visits','DELETE') AS can_delete, (SELECT count(*) FROM public.welcome_qr_visits WHERE visit_day=(now() AT TIME ZONE 'Asia/Seoul')::date) AS today_count");
    if (access.can_read || access.can_delete || Number(access.today_count) !== 1) throw new Error('QR permission or date verification failed');
    await client.query('ROLLBACK TO SAVEPOINT qr_verification');
    await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ($1,$2,$3)',
      [version, name, [sql]]);
    console.log(`${apply ? 'Applied' : 'Validated'} ${filename}`);
  }
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  inTransaction = false;
  console.log(apply ? 'Committed QR visit migration.' : 'Rolled back dry-run; production unchanged.');
} catch (error) {
  if (inTransaction) await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ message: error.message, code: error.code, detail: error.detail,
    position: error.position, internalPosition: error.internalPosition,
    internalQuery: error.internalQuery, where: error.where, routine: error.routine }));
  process.exitCode = 1;
} finally { await client.end(); }
