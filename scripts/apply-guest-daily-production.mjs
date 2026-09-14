import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

// Explicit --apply is required. Default is a read-only schema/impact check.
const apply = process.argv.includes('--apply');
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
if (project !== 'erecqalsxoxrufggvmcc') throw new Error('Unexpected linked project');
const dry = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
    ['/d','/s','/c','npx supabase db dump --linked --schema public --dry-run'],
    { encoding: 'utf8', stdio: ['ignore','pipe','ignore'], maxBuffer: 2_000_000 });
const value = name => dry.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE'].some(name => !value(name))) throw new Error('Linked credentials unavailable');
const sql = await readFile('supabase/manual/proposals/20260910_guest_daily_applications.sql','utf8');
const client = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')), user: value('PGUSER'),
    password: value('PGPASSWORD'), database: value('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt','utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, application_name: 'approved-guest-daily-migration' });
try {
    await client.connect();
    await client.query(apply ? 'BEGIN ISOLATION LEVEL REPEATABLE READ' : 'BEGIN READ ONLY');
    await client.query('SET LOCAL ROLE postgres');
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='20s'");
    const required = {
        daily_program_sessions: ['id','notice_id','session_date','starts_at','voided_at','status','capacity'],
        daily_program_session_responses: ['session_id','user_id','status','created_at','cancelled_at'],
        users: ['id','name','phone','birth','role','user_group','status'],
        notices: ['id','category','is_recruiting','is_challenge','guest_properties','program_status'],
    };
    const columns = (await client.query(`SELECT table_name,column_name,data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name=ANY($1)`, [Object.keys(required)])).rows;
    for (const [table, names] of Object.entries(required)) for (const name of names) {
        if (!columns.some(c => c.table_name === table && c.column_name === name)) throw new Error(`Missing required column ${table}.${name}`);
    }
    const existing = (await client.query(`SELECT
        to_regprocedure('public.apply_guest_program_session(uuid,uuid,text,text,text,jsonb)') IS NOT NULL AS rpc,
        to_regclass('public.guest_program_session_applications') IS NOT NULL AS fallback`)).rows[0];
    const snapshot = async () => (await client.query(`SELECT
        (SELECT count(*)::int FROM public.users) AS users,
        (SELECT count(*)::int FROM public.logs) AS logs,
        (SELECT count(*)::int FROM public.daily_program_sessions) AS sessions,
        (SELECT count(*)::int FROM public.daily_program_session_responses) AS responses,
        (SELECT md5(COALESCE(string_agg((to_jsonb(r)-'application_answers')::text,'' ORDER BY session_id,user_id),''))
            FROM public.daily_program_session_responses r) AS response_fingerprint`)).rows[0];
    const before = await snapshot();
    if (apply) {
        if (existing.rpc || existing.fallback) throw new Error('Migration objects already exist; inspect before retrying');
        const body = sql.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
        await client.query(body);
        const after = await snapshot();
        if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Preservation check failed; rolling back');
        await client.query('COMMIT');
        console.log(JSON.stringify({ status: 'applied', project, sha256: createHash('sha256').update(sql).digest('hex'),
            preserved: { users: after.users, logs: after.logs, sessions: after.sessions, responses: after.responses } }));
    } else {
        await client.query('ROLLBACK');
        console.log(JSON.stringify({ status: 'preflight_passed', project, requiredColumnsPresent: true, existing,
            rows: { users: before.users, logs: before.logs, sessions: before.sessions, responses: before.responses },
            sha256: createHash('sha256').update(sql).digest('hex') }));
    }
} catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ status: 'failed', code: error.code || 'validation', message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]') }));
    process.exitCode = 1;
} finally { await client.end(); }
