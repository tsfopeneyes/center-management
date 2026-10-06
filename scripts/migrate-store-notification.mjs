import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { normalizeRoutingConfig } from '../supabase/functions/_shared/notificationRouting.mjs';

const mode = process.argv[2];
if (!['--dry-run', '--apply', '--verify'].includes(mode)) throw new Error('Use --dry-run, --apply or --verify');
const projectRef = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
if (projectRef !== 'erecqalsxoxrufggvmcc') throw new Error('Unexpected project');
const output = execFileSync(process.env.ComSpec, ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const credential = name => output.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !credential(name))) throw new Error('Missing credentials');
const client = new pg.Client({ host: credential('PGHOST'), port: Number(credential('PGPORT')),
  user: credential('PGUSER'), password: credential('PGPASSWORD'), database: credential('PGDATABASE'),
  ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
  connectionTimeoutMillis: 10000, application_name: 'store-notification-migration' });
let open = false;
try {
  await client.connect();
  await client.query('BEGIN'); open = true;
  await client.query("SET LOCAL lock_timeout = '2s'; SET LOCAL statement_timeout = '15s'");
  const identity = (await client.query("SELECT current_user AS role, pg_has_role(current_user,'postgres','MEMBER') AS owner")).rows[0];
  if (identity.role !== 'cli_login_postgres' || !identity.owner) throw new Error('Unexpected role');
  await client.query('SET LOCAL ROLE postgres');
  const constraints = (await client.query(`SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid='public.notification_delivery_logs'::regclass AND conname='notification_delivery_logs_category_check'`)).rows;
  if (constraints.length !== 1) throw new Error('Unexpected constraint');
  const definition = constraints[0].definition;
  const categories = [...definition.matchAll(/'([^']+)'::text/g)].map(match => match[1]).sort();
  if (mode === '--verify') {
    if (JSON.stringify(categories) !== JSON.stringify(['coffee_chat','program','rental','store','visit'])) throw new Error('Store category missing');
    const settings = (await client.query("SELECT value FROM public.global_settings WHERE key='notification_routing_config'")).rows;
    const routing = normalizeRoutingConfig(settings[0]?.value);
    if (!routing.HAIFN.slack.store) throw new Error('HAIFN Slack store route disabled');
    await client.query('ROLLBACK'); open = false;
    console.log(JSON.stringify({ projectRef, result: 'verified', categories, haifnSlackStoreEnabled: routing.HAIFN.slack.store }));
    await client.end();
    process.exit(0);
  }
  if (JSON.stringify(categories) !== JSON.stringify(['coffee_chat','program','rental','visit'])) throw new Error('Unexpected category definition; review before proceeding');
  const before = (await client.query('SELECT category, count(*)::integer AS count FROM public.notification_delivery_logs GROUP BY category ORDER BY category')).rows;
  const source = await readFile('supabase/manual/proposals/20261002_store_notification_category.sql', 'utf8');
  await client.query(source.split(/\r?\n/).filter(line => !/^(BEGIN|COMMIT);$/.test(line.trim())).join('\n'));
  const after = (await client.query('SELECT category, count(*)::integer AS count FROM public.notification_delivery_logs GROUP BY category ORDER BY category')).rows;
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Log counts changed');
  await client.query(mode === '--dry-run' ? 'ROLLBACK' : 'COMMIT'); open = false;
  console.log(JSON.stringify({ projectRef, mode, result: mode === '--dry-run' ? 'rolled_back' : 'committed', originalConstraint: definition, preservedLogCounts: before }));
} catch (error) {
  console.error(JSON.stringify({ result: 'failed', code: error.code, message: error.message })); process.exitCode = 1;
} finally {
  if (open) await client.query('ROLLBACK').catch(() => {});
  await client.end();
}
