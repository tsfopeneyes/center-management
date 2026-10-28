import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const mode = process.argv[2] || '--inspect';
if (!['--inspect', '--dry-run', '--apply'].includes(mode)) throw new Error('Expected --inspect, --dry-run or --apply');
const filename = '20261015090000_school_map_locations.sql';
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
if (project !== 'erecqalsxoxrufggvmcc') throw new Error('Unexpected linked project');
let dry;
try {
    dry = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
        ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000, timeout: 60000 });
} catch {
    // CLI output can contain credentials; never include it in an exception.
    throw new Error('Supabase linked credentials could not be loaded. Check CLI access and connectivity.');
}
const value = name => dry.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !value(name))) throw new Error('Linked credentials unavailable');
const client = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')), user: value('PGUSER'),
    password: value('PGPASSWORD'), database: value('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, application_name: 'school-map-migration' });
let transaction = false;
try {
    await client.connect();
    await client.query('SET ROLE postgres');
    const { rows: columns } = await client.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='schools'");
    const { rows: policies } = await client.query("SELECT policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='schools'");
    const { rows: [before] } = await client.query('SELECT count(*)::int AS count FROM public.schools');
    console.log(JSON.stringify({ project, schoolCount: before.count, columns, policies }));
    if (mode !== '--inspect') {
        await client.query('BEGIN'); transaction = true;
        await client.query('SET LOCAL ROLE postgres');
        await client.query("SET LOCAL lock_timeout='5s'");
        await client.query("SET LOCAL statement_timeout='30s'");
        const version = filename.slice(0, 14), name = filename.slice(15, -4);
        const { rows: applied } = await client.query('SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1', [version]);
        if (applied.length) throw new Error('Migration already applied');
        const sql = (await readFile(`supabase/migrations/${filename}`, 'utf8')).replace(/^BEGIN;|^COMMIT;/gm, '');
        await client.query(sql);
        const { rows: [after] } = await client.query('SELECT count(*)::int AS count, count(map_latitude)::int AS located FROM public.schools');
        if (after.count !== before.count || after.located !== 0) throw new Error('Unexpected record changes');
        await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ($1,$2,$3)', [version, name, [sql]]);
        await client.query(mode === '--apply' ? 'COMMIT' : 'ROLLBACK'); transaction = false;
        console.log(JSON.stringify({ mode, schoolCount: after.count, located: after.located, result: mode === '--apply' ? 'committed' : 'rolled back' }));
    }
} catch (error) {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ message: error.message, code: error.code })); process.exitCode = 1;
} finally { await client.end(); }
