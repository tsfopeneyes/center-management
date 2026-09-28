import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const apply = process.argv[2] === '--apply';
if (process.argv.length > 3 || (process.argv[2] && !['--apply', '--dry-run'].includes(process.argv[2])))
  throw new Error('Usage: node scripts/apply-challenge-feature-migrations.mjs [--dry-run|--apply]');
const migrations = [
  '20260920010000_challenge_host_post_mission_correction.sql',
  '20260920020000_settle_challenge_rewards_on_close.sql',
  '20260920030000_program_rewards_on_close.sql',
  '20260920040000_allow_host_daily_to_flexible.sql',
];
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
    const sql = await readFile(`supabase/migrations/${filename}`, 'utf8');
    await client.query(sql);
    await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ($1,$2,$3)',
      [version, name, [sql]]);
    console.log(`${apply ? 'Applied' : 'Validated'} ${filename}`);
  }
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  inTransaction = false;
  console.log(apply ? 'Committed four challenge feature migrations.' : 'Rolled back dry-run; production unchanged.');
} catch (error) {
  if (inTransaction) await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ message: error.message, code: error.code, detail: error.detail,
    position: error.position, internalPosition: error.internalPosition,
    internalQuery: error.internalQuery, where: error.where, routine: error.routine }));
  process.exitCode = 1;
} finally { await client.end(); }
