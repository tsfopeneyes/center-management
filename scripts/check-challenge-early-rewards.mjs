import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

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
  connectionTimeoutMillis: 10000, application_name: 'read-only-challenge-reward-audit' });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  await client.query('SET LOCAL ROLE postgres');
  const { rows } = await client.query(`SELECT
    count(*)::integer AS completion_rows,
    count(*) FILTER (WHERE r.transaction_id IS NOT NULL)::integer AS paid_rows,
    count(*) FILTER (WHERE r.transaction_id IS NOT NULL AND n.program_status IS DISTINCT FROM 'COMPLETED')::integer AS paid_before_close
    FROM public.challenge_completion_rewards r JOIN public.notices n ON n.id = r.challenge_id`);
  console.log(JSON.stringify(rows[0]));
  await client.query('ROLLBACK');
} finally { await client.end(); }
