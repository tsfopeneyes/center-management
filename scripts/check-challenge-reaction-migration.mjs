import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
if (project !== 'erecqalsxoxrufggvmcc') throw new Error('Unexpected linked project');

const dry = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
  ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000 });
const value = name => dry.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !value(name))) {
  throw new Error('Linked credentials unavailable');
}

let sql = await readFile('supabase/migrations/20260928030000_keep_challenge_reactions_open_after_end.sql', 'utf8');
sql = sql
  .replace(/^\s*BEGIN;\s*/i, '')
  .replace(/\s*COMMIT;\s*/i, '\n')
  .replace(/\s*NOTIFY\s+pgrst\s*,\s*'reload schema'\s*;?\s*$/i, '');

const client = new pg.Client({
  host: value('PGHOST'), port: Number(value('PGPORT')), user: value('PGUSER'),
  password: value('PGPASSWORD'), database: value('PGDATABASE'),
  ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
  connectionTimeoutMillis: 10000,
  application_name: 'rollback-only-challenge-reaction-check',
});

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE postgres');
  await client.query("SET LOCAL lock_timeout='3s'");
  await client.query(sql);

  const { rows: [policy] } = await client.query(`
    SELECT pg_get_expr(polqual, polrelid) AS using_expression,
           pg_get_expr(polwithcheck, polrelid) AS check_expression,
           polcmd,
           polroles = ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')] AS authenticated_only
    FROM pg_policy
    WHERE polrelid='public.community_channel_reactions'::regclass
      AND polname='channel_reactions_write'
  `);

  assert.ok(policy, 'reaction write policy missing');
  assert.equal(policy.polcmd, '*');
  assert.equal(policy.authenticated_only, true);
  assert.match(policy.using_expression, /is_current_profile/);
  assert.match(policy.using_expression, /is_community_admin/);
  assert.match(policy.check_expression, /can_access_community_channel/);
  assert.match(policy.check_expression, /deleted_at IS NULL/);
  assert.match(policy.check_expression, /NOT post\.is_hidden/);
  assert.doesNotMatch(policy.check_expression, /program_end_date/);

  await client.query('ROLLBACK');
  console.log('PASS challenge reaction migration: rollback-only DDL; ended channels allowed; membership, visible-post and ownership guards retained');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  throw error;
} finally {
  await client.end();
}
