import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { legacyGuestMigrationIssue } from '../src/features/programs/applicationFormModel.js';

// Read-only catalog and aggregate impact audit. No personal fields, answer
// values, application rows, or writes are returned.
const expectedProjectRef = 'erecqalsxoxrufggvmcc';
const projectRef = (await readFile(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim();
if (projectRef !== expectedProjectRef) throw new Error('Unexpected linked Supabase project');

let cliOutput;
try {
    cliOutput = execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
        ['/d', '/s', '/c', 'npx supabase db dump --linked --schema public --dry-run'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2_000_000 });
} catch {
    throw new Error('Unable to obtain read-only linked database connection settings');
}
const credential = (name) => cliOutput.match(new RegExp(`export ${name}="([^"]+)"`))?.[1];
if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].some(name => !credential(name))) {
    throw new Error('Linked database credentials are unavailable');
}

const client = new pg.Client({
    host: credential('PGHOST'),
    port: Number(credential('PGPORT')),
    user: credential('PGUSER'),
    password: credential('PGPASSWORD'),
    database: credential('PGDATABASE'),
    ssl: {
        ca: await readFile('C:/Users/Jin/Downloads/prod-ca-2021.crt', 'utf8'),
        rejectUnauthorized: true,
    },
    connectionTimeoutMillis: 10_000,
    application_name: 'read-only-program-application-schema-audit',
});

const tables = ['notices', 'notice_responses', 'daily_program_sessions', 'daily_program_session_responses',
    'program_application_attempt_history', 'program_session_application_attempt_history'];
let transactionOpen = false;
try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '3s'");
    if (process.argv.includes('--owner-read-only')) {
        const identity = await client.query(`
            SELECT current_user AS role_name,
                pg_has_role(current_user, 'postgres', 'MEMBER') AS is_owner_member
        `);
        if (identity.rows[0]?.role_name !== 'cli_login_postgres'
            || identity.rows[0]?.is_owner_member !== true) {
            throw new Error('Unexpected linked role; refusing temporary owner access');
        }
        // Session-local escalation only inside a READ ONLY transaction. There
        // is no persistent GRANT, and ROLLBACK in finally restores the role.
        await client.query('SET LOCAL ROLE postgres');
    }

    const columns = await client.query(`
        SELECT cls.relname AS table_name, attr.attname AS column_name,
            format_type(attr.atttypid, attr.atttypmod) AS data_type,
            NOT attr.attnotnull AS nullable
        FROM pg_attribute attr
        JOIN pg_class cls ON cls.oid = attr.attrelid
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE ns.nspname = 'public' AND cls.relname = ANY($1::text[])
            AND attr.attnum > 0 AND NOT attr.attisdropped
        ORDER BY cls.relname, attr.attnum
    `, [[...tables, 'users']]);
    const policies = await client.query(`
        SELECT tablename, policyname, cmd, roles, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = ANY($1::text[])
        ORDER BY tablename, policyname
    `, [[...tables, 'users']]);
    const triggers = await client.query(`
        SELECT cls.relname AS table_name, trg.tgname AS trigger_name,
            pg_get_triggerdef(trg.oid) AS definition
        FROM pg_trigger trg
        JOIN pg_class cls ON cls.oid = trg.tgrelid
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE ns.nspname = 'public' AND cls.relname = ANY($1::text[])
            AND NOT trg.tgisinternal
        ORDER BY cls.relname, trg.tgname
    `, [[...tables, 'users']]);
    const constraints = await client.query(`
        SELECT cls.relname AS table_name, con.conname AS constraint_name,
            pg_get_constraintdef(con.oid) AS definition
        FROM pg_constraint con
        JOIN pg_class cls ON cls.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE ns.nspname = 'public' AND cls.relname = ANY($1::text[])
        ORDER BY cls.relname, con.conname
    `, [[...tables, 'users']]);
    const indexes = await client.query(`
        SELECT tablename AS table_name, indexname AS index_name, indexdef AS definition
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = ANY($1::text[])
        ORDER BY tablename, indexname
    `, [[...tables, 'users']]);
    const privileges = await client.query(`
        SELECT table_name, role_name,
            has_table_privilege(role_name, format('public.%I', table_name), 'SELECT') AS can_select,
            has_table_privilege(role_name, format('public.%I', table_name), 'INSERT') AS can_insert,
            has_table_privilege(role_name, format('public.%I', table_name), 'UPDATE') AS can_update
        FROM unnest($1::text[]) AS table_name
        CROSS JOIN (VALUES ('anon'), ('authenticated')) AS roles(role_name)
        WHERE to_regclass(format('public.%I', table_name)) IS NOT NULL
        ORDER BY table_name, role_name
    `, [tables]);
    const functions = await client.query(`
        SELECT proc.proname AS function_name, pg_get_functiondef(proc.oid) AS definition
        FROM pg_proc proc
        JOIN pg_namespace ns ON ns.oid = proc.pronamespace
        WHERE ns.nspname = 'public' AND proc.proname = ANY($1::text[])
        ORDER BY proc.proname
    `, [[
        'respond_to_program_session',
        'program_application_transition',
        'program_application_audience_for_user',
        'program_session_transition',
        'add_staff_program_walkins',
        'add_staff_program_session_walkins',
        'archive_cancelled_program_application_attempt',
        'archive_cancelled_program_session_application_attempt',
        'mark_daily_program_attendance_on_join',
        'refresh_program_session_join_count',
        'guard_program_recruitment_response',
        'is_current_staff',
        'calendar_is_admin',
        'carry_legacy_program_applicants_to_first_session',
        'can_access_community_channel',
        'guard_survey_entry',
        'settle_program_rewards_on_close',
        'validate_program_application_form',
        'validate_program_application_answers',
        'revise_program_application_form',
        'create_application_state_notification',
    ]]);
    const responseConsumers = await client.query(`
        SELECT 'function' AS kind, proc.proname AS name
        FROM pg_proc proc JOIN pg_namespace ns ON ns.oid = proc.pronamespace
        WHERE ns.nspname = 'public' AND proc.prokind IN ('f', 'p')
            AND pg_get_functiondef(proc.oid) ILIKE '%notice_responses%'
        UNION ALL
        SELECT 'view' AS kind, viewname AS name FROM pg_views
        WHERE schemaname = 'public' AND definition ILIKE '%notice_responses%'
        ORDER BY kind, name
    `);

    const readAccess = await client.query(`
        SELECT cls.relname AS table_name,
            pg_get_userbyid(cls.relowner) AS table_owner,
            has_table_privilege(current_user, cls.oid, 'SELECT') AS can_read,
            pg_has_role(current_user, cls.relowner, 'MEMBER') AS is_owner_member
        FROM pg_class cls
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE ns.nspname = 'public' AND cls.relname = ANY($1::text[])
        ORDER BY cls.relname
    `, [[...tables, 'users']]);
    const roleInfo = await client.query('SELECT current_user AS current_role, session_user AS session_role');
    const missingReadPrivileges = readAccess.rows
        .filter(row => !row.can_read).map(row => row.table_name);
    let impact = { available: false, role: roleInfo.rows[0], missingReadPrivileges,
        access: readAccess.rows };
    if (missingReadPrivileges.length === 0) {
    const programKinds = await client.query(`
        SELECT COALESCE(category, '(null)') AS category,
            is_recruiting,
            is_challenge,
            COALESCE(guest_properties->>'application_scope', '(null)') AS application_scope,
            COALESCE(guest_properties->>'schedule_mode', '(null)') AS schedule_mode,
            count(*)::integer AS notice_count
        FROM public.notices
        GROUP BY category, is_recruiting, is_challenge,
            guest_properties->>'application_scope', guest_properties->>'schedule_mode'
        ORDER BY category, is_recruiting, is_challenge, application_scope, schedule_mode
    `);
    const responseGroups = await client.query(`
        SELECT COALESCE(n.category, '(missing)') AS category,
            n.is_challenge,
            COALESCE(n.guest_properties->>'application_scope', '(null)') AS application_scope,
            r.status,
            COALESCE(u.user_group, '(missing)') AS user_group,
            count(*)::integer AS response_count,
            count(*) FILTER (WHERE r.application_answers <> '{}'::jsonb)::integer AS with_answers
        FROM public.notice_responses r
        LEFT JOIN public.notices n ON n.id = r.notice_id
        LEFT JOIN public.users u ON u.id = r.user_id
        GROUP BY n.category, n.is_challenge, n.guest_properties->>'application_scope',
            r.status, u.user_group
        ORDER BY category, n.is_challenge, application_scope, r.status, user_group
    `);
    const sessionResponseGroups = await client.query(`
        SELECT r.status,
            COALESCE(u.user_group, '(missing)') AS user_group,
            count(*)::integer AS response_count,
            count(*) FILTER (WHERE r.application_answers <> '{}'::jsonb)::integer AS with_answers,
            count(*) FILTER (WHERE r.is_attended)::integer AS attended_count
        FROM public.daily_program_session_responses r
        LEFT JOIN public.users u ON u.id = r.user_id
        GROUP BY r.status, u.user_group
        ORDER BY r.status, user_group
    `);
    const sessionCancellationHealth = await client.query(`
        SELECT count(*) FILTER (WHERE status = 'CANCELLED')::integer AS cancelled_rows,
            count(*) FILTER (WHERE status = 'CANCELLED' AND cancelled_at IS NULL)::integer
                AS cancelled_without_timestamp
        FROM public.daily_program_session_responses
    `);
    const guestFieldRows = await client.query(`
        SELECT guest_properties->'custom_fields' AS custom_fields
        FROM public.notices WHERE category = 'PROGRAM'
    `);
    const guestFieldShapes = guestFieldRows.rows.reduce((counts, row) => {
        counts.programCount += 1;
        if (Array.isArray(row.custom_fields)) {
            counts.fieldCount += row.custom_fields.length;
            if (row.custom_fields.length) counts.programsWithFields += 1;
        }
        if (legacyGuestMigrationIssue({ custom_fields: row.custom_fields })) counts.programsNeedingReview += 1;
        return counts;
    }, { programCount: 0, programsWithFields: 0, fieldCount: 0, programsNeedingReview: 0 });
    const phoneGroups = await client.query(`
        WITH normalized AS (
            SELECT regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') AS digits,
                count(*)::integer AS account_count
            FROM public.users
            WHERE phone IS NOT NULL AND btrim(phone) <> ''
            GROUP BY regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
        )
        SELECT count(*) FILTER (WHERE account_count > 1)::integer AS duplicate_phone_groups,
            COALESCE(sum(account_count) FILTER (WHERE account_count > 1), 0)::integer
                AS accounts_in_duplicate_groups,
            count(*) FILTER (WHERE account_count > 1 AND length(digits) = 11)::integer
                AS duplicate_eleven_digit_groups
        FROM normalized WHERE digits <> ''
    `);
    const duplicatePhoneKinds = await client.query(`
        WITH grouped AS (
            SELECT regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') AS digits,
                count(*)::integer AS account_count,
                count(*) FILTER (WHERE user_group = '게스트')::integer AS guest_count,
                count(*) FILTER (WHERE user_group IS DISTINCT FROM '게스트')::integer AS other_count
            FROM public.users
            WHERE phone IS NOT NULL AND btrim(phone) <> ''
            GROUP BY regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
        )
        SELECT account_count, guest_count, other_count, count(*)::integer AS group_count
        FROM grouped WHERE account_count > 1 AND length(digits) = 11
        GROUP BY account_count, guest_count, other_count
        ORDER BY account_count, guest_count, other_count
    `);

    impact = {
        available: true,
        role: roleInfo.rows[0],
        programKinds: programKinds.rows,
        responseGroups: responseGroups.rows,
        sessionResponseGroups: sessionResponseGroups.rows,
        sessionCancellationHealth: sessionCancellationHealth.rows[0],
        guestFieldShapes,
        phoneGroupImpact: phoneGroups.rows[0],
        duplicatePhoneKinds: duplicatePhoneKinds.rows,
    };
    }
    console.log(JSON.stringify(process.argv.includes('--impact-only') ? { projectRef, impact } : {
        projectRef,
        tables: [...new Set(columns.rows.map(row => row.table_name))],
        columns: columns.rows,
        policies: policies.rows,
        triggers: triggers.rows,
        constraints: constraints.rows,
        indexes: indexes.rows,
        privileges: privileges.rows,
        functions: functions.rows,
        responseConsumers: responseConsumers.rows,
        tableAccess: readAccess.rows,
        impact,
    }, null, 2));
} finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
}
