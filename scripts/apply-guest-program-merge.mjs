import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectCommunityDb, communityProject } from './community-db.mjs';

const apply = process.argv.includes('--apply');
const version = '20261019020000';
const sql = (await readFile(`supabase/migrations/${version}_guest_program_merge_continuity.sql`, 'utf8')).replace(/^BEGIN;|^COMMIT;/gm, '');
const sha256 = createHash('sha256').update(sql).digest('hex');
const directory = 'artifacts/guest-program-merge';
await mkdir(directory, { recursive: true });
const db = await connectCommunityDb();
const ident = value => '"' + value.replaceAll('"', '""') + '"';
try {
    await db.query('BEGIN');
    await db.query('SET LOCAL ROLE postgres');
    await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
    assert.equal((await db.query('SELECT count(*)::int n FROM supabase_migrations.schema_migrations WHERE version=$1', [version])).rows[0].n, 0);
    const tables = (await db.query(`SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN('r','p') AND (EXISTS(SELECT 1 FROM pg_constraint fk
        WHERE fk.conrelid=c.oid AND fk.contype='f' AND fk.confrelid='public.users'::regclass)
        OR c.relname IN('program_application_attempt_history','program_session_application_attempt_history'))`)).rows;
    const oids = tables.map(table => table.oid);
    const tableGrants = (await db.query(`SELECT c.relname,x.privilege_type FROM pg_class c,
        LATERAL aclexplode(c.relacl) x WHERE c.oid=ANY($1::oid[]) AND x.grantee='account_merge_worker'::regrole
        AND x.privilege_type IN('SELECT','UPDATE','DELETE')`, [oids])).rows;
    const columnGrants = (await db.query(`SELECT c.relname,a.attname,x.privilege_type FROM pg_class c
        JOIN pg_attribute a ON a.attrelid=c.oid,LATERAL aclexplode(a.attacl) x
        WHERE c.oid=ANY($1::oid[]) AND x.grantee='account_merge_worker'::regrole
        AND x.privilege_type IN('SELECT','UPDATE')`, [oids])).rows;
    const columns = (await db.query(`SELECT c.relname,a.attname FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
        WHERE c.oid=ANY($1::oid[]) AND a.attnum>0 AND NOT a.attisdropped`, [oids])).rows;
    const counts = async () => (await db.query(`SELECT
        (SELECT count(*) FROM public.users) AS profiles,(SELECT count(*) FROM public.logs) AS logs,
        (SELECT count(*) FROM public.notice_responses) AS applications,
        (SELECT count(*) FROM public.daily_program_session_responses) AS session_applications,
        (SELECT count(*) FROM public.open_program_attendance) AS attendance,
        (SELECT count(*) FROM public.program_application_attempt_history) AS application_history,
        (SELECT count(*) FROM public.program_session_application_attempt_history) AS session_history`)).rows[0];
    const before = await counts();
    const triggerFunctions = (await db.query(`SELECT pg_get_functiondef(p.oid) AS definition FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
        AND p.proname IN('create_application_state_notification','guard_program_recruitment_response')`)).rows;
    if (apply) assert.equal(JSON.parse(await readFile(`${directory}/dry-run.json`, 'utf8')).sha256, sha256);
    await db.query(sql);
    assert.deepEqual(await counts(), before, 'existing record counts must not change');
    const missing = (await db.query(`SELECT count(*)::int AS n FROM pg_constraint fk
        JOIN pg_class c ON c.oid=fk.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=fk.conkey[1]
        WHERE fk.contype='f' AND fk.confrelid='public.users'::regclass AND n.nspname='public'
        AND cardinality(fk.conkey)=1 AND cardinality(fk.confkey)=1
        AND NOT has_column_privilege('account_merge_worker',c.oid,a.attnum,'SELECT')`)).rows[0].n;
    assert.equal((await db.query(`SELECT has_function_privilege('account_merge_worker',
        'account_security.merge_reference_has_rows(text,text,uuid)','EXECUTE') AS allowed`)).rows[0].allowed,true);
    assert.equal((await db.query(`SELECT has_table_privilege('authenticated',
        'account_security.account_merge_program_originals','SELECT') AS allowed`)).rows[0].allowed, false);
    // No private message bodies become readable as a side effect of FK auditing.
    assert.equal((await db.query(`SELECT has_table_privilege('account_merge_worker','public.dm_messages','SELECT') AS allowed`)).rows[0].allowed, false);
    const policies = (await db.query(`SELECT tablename,policyname FROM pg_policies WHERE schemaname='public'
        AND policyname='guest_program_merge_transfer'`)).rows;
    const restore = [
        ...triggerFunctions.map(f => f.definition + ';'),
        ...policies.map(p => `DROP POLICY IF EXISTS ${ident(p.policyname)} ON public.${ident(p.tablename)};`),
        ...tables.map(t => `REVOKE SELECT,UPDATE,DELETE ON public.${ident(t.relname)} FROM account_merge_worker;`),
        ...columns.map(c => `REVOKE SELECT(${ident(c.attname)}),UPDATE(${ident(c.attname)}) ON public.${ident(c.relname)} FROM account_merge_worker;`),
        ...tableGrants.map(g => `GRANT ${g.privilege_type} ON public.${ident(g.relname)} TO account_merge_worker;`),
        ...columnGrants.map(g => `GRANT ${g.privilege_type}(${ident(g.attname)}) ON public.${ident(g.relname)} TO account_merge_worker;`),
        'REVOKE INSERT ON account_security.account_merge_program_originals FROM account_merge_worker;',
        'REVOKE EXECUTE ON FUNCTION account_security.merge_reference_has_rows(text,text,uuid) FROM account_merge_worker;',
    ];
    await writeFile(`${directory}/restore-permissions.sql`, '-- Restore prior merge permissions. Preserve all application originals and audit records.\nBEGIN;\n' + restore.join('\n') + '\nCOMMIT;\n');
    if (apply) await db.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',
        [version, 'guest_program_merge_continuity', [sql]]);
    await db.query(apply ? 'COMMIT' : 'ROLLBACK');
    const result = { status: apply ? 'applied' : 'dry_run_passed', project: communityProject, sha256, before,
        existingRecordsChanged: 0, referencesAuditedByPrivateExistenceCheck: missing };
    await writeFile(`${directory}/${apply ? 'applied' : 'dry-run'}.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
} catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
} finally { await db.end(); }
