import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const mode = process.argv[2];
if (!['--audit', '--record'].includes(mode) || process.argv.length !== 3)
    throw new Error('Use exactly --audit or --record');
const version = '20260930010000';
const name = 'haifn_intro_chat';
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
assert.equal(project, 'erecqalsxoxrufggvmcc', 'Unexpected linked project');
const source = await readFile(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const expectedBody = source.match(/CREATE FUNCTION public\.haifn_chat_update_session_from_message\(\) RETURNS trigger\s+LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS \$\$([\s\S]*?)\$\$;/)?.[1];
assert.ok(expectedBody, 'Migration function source is missing');
const dry = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
    ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000 });
const value = key => dry.match(new RegExp(`export ${key}="([^"]+)"`))?.[1];
const db = new pg.Client({ host: value('PGHOST'), port: Number(value('PGPORT')), user: value('PGUSER'),
    password: value('PGPASSWORD'), database: value('PGDATABASE'),
    ssl: { ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, application_name: `haifn-chat-migration-${mode.slice(2)}` });
const tables = ['haifn_chat_sessions','haifn_chat_messages','haifn_chat_operators','haifn_chat_operator_notifications'];
const policyNames = ['haifn_chat_operator_self','haifn_chat_notification_read',
    'haifn_chat_notification_mark_read','haifn_chat_staff_sessions',
    'haifn_chat_staff_sessions_update','haifn_chat_staff_messages_read',
    'haifn_chat_staff_messages_write'];
let committed = false;
try {
    await db.connect();
    await db.query(mode === '--audit' ? 'BEGIN READ ONLY' : 'BEGIN');
    await db.query('SET LOCAL ROLE postgres');
    await db.query("SET LOCAL statement_timeout='8s'");
    await db.query("SET LOCAL lock_timeout='3s'");
    const { rows: relations } = await db.query(`SELECT c.relname,c.relkind,c.relrowsecurity
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname`, [tables]);
    assert.deepEqual(relations.map(row => row.relname), [...tables].sort());
    assert.ok(relations.every(row => row.relkind === 'r' && row.relrowsecurity));
    const { rows: columns } = await db.query(`SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,
        a.attnotnull FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname=ANY($1::text[])
          AND a.attnum>0 AND NOT a.attisdropped`, [tables]);
    const actualColumns = new Map(columns.map(row => [`${row.relname}.${row.attname}`, row]));
    for (const [table, names] of Object.entries({
        haifn_chat_sessions:['id','token_hash','status','assigned_to','created_at','updated_at'],
        haifn_chat_messages:['id','session_id','sender','sender_id','body','created_at'],
        haifn_chat_operators:['user_id'],
        haifn_chat_operator_notifications:['message_id','operator_id','read_at'],
    })) {
        assert.equal(columns.filter(row => row.relname===table).length,names.length,`${table} column count`);
        for (const column of names) assert.ok(actualColumns.has(`${table}.${column}`),`${table}.${column}`);
    }
    const { rows: policies } = await db.query(`SELECT policyname,tablename,cmd,roles,qual,with_check
        FROM pg_policies WHERE schemaname='public' AND tablename=ANY($1::text[])`, [tables]);
    assert.deepEqual(policies.map(row => row.policyname).sort(), [...policyNames].sort());
    assert.ok(policies.every(row => row.roles.includes('authenticated')));
    const byPolicy = new Map(policies.map(row => [row.policyname,row]));
    assert.match(byPolicy.get('haifn_chat_operator_self').qual,/is_current_staff/);
    assert.match(byPolicy.get('haifn_chat_notification_read').qual,/current_profile_id/);
    assert.match(byPolicy.get('haifn_chat_notification_mark_read').with_check,/current_profile_id/);
    assert.match(byPolicy.get('haifn_chat_staff_messages_write').with_check,/current_profile_id/);
    const { rows: [trigger] } = await db.query(`SELECT pg_get_triggerdef(t.oid) AS definition
        FROM pg_trigger t WHERE t.tgrelid='public.haifn_chat_messages'::regclass
          AND t.tgname='haifn_chat_message_touches_session' AND NOT t.tgisinternal`);
    assert.match(trigger?.definition||'',/AFTER INSERT/);
    const { rows: [fn] } = await db.query(`SELECT p.prosrc,p.prosecdef
        FROM pg_proc p WHERE p.oid='public.haifn_chat_update_session_from_message()'::regprocedure`);
    assert.equal(fn?.prosecdef,true);
    assert.equal(fn?.prosrc.trim().replaceAll('\r\n','\n'),expectedBody.trim().replaceAll('\r\n','\n'));
    const { rows: indexes } = await db.query(`SELECT indexname FROM pg_indexes
        WHERE schemaname='public' AND tablename=ANY($1::text[])`, [tables]);
    for (const index of ['haifn_chat_unread_operator_idx','haifn_chat_sessions_updated_idx',
        'haifn_chat_messages_session_created_idx'])
        assert.ok(indexes.some(row => row.indexname===index),`Missing ${index}`);
    const { rows: [access] } = await db.query(`SELECT
      has_table_privilege('anon','public.haifn_chat_sessions','SELECT') AS anon_sessions_read,
      has_table_privilege('anon','public.haifn_chat_messages','INSERT') AS anon_messages_write,
      has_column_privilege('authenticated','public.haifn_chat_sessions','status','UPDATE') AS staff_status_update,
      has_column_privilege('authenticated','public.haifn_chat_messages','body','INSERT') AS staff_message_write`);
    assert.deepEqual(access,{anon_sessions_read:false,anon_messages_write:false,
        staff_status_update:true,staff_message_write:true});
    const { rows: [seed] } = await db.query(`SELECT count(*)::int AS operators FROM public.haifn_chat_operators`);
    assert.equal(seed.operators,4);
    const { rows: existing } = await db.query(`SELECT version FROM supabase_migrations.schema_migrations WHERE version=$1`,[version]);
    if (mode === '--record') {
        assert.equal(existing.length,0,'Migration history already contains this version');
        await db.query(`INSERT INTO supabase_migrations.schema_migrations(version,statements,name,created_by)
          VALUES($1,ARRAY[$2]::text[],$3,'codex-reviewed-reconciliation')`,[version,source,name]);
        await db.query('COMMIT');
        committed = true;
        console.log(`RECORDED ${version}_${name}: verified live schema, no user data changed`);
    } else {
        await db.query('ROLLBACK');
        console.log(`PASS read-only live audit: ${tables.length} tables, ${policies.length} policies, 1 trigger, matching function, 4 operators; history=${existing.length}`);
    }
} catch (error) {
    if (!committed) try { await db.query('ROLLBACK'); } catch {}
    throw error;
} finally {
    await db.end();
}
