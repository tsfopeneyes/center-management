import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
    await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE FUNCTION public.respond_to_program_application(bigint,uuid,text,jsonb)
            RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
        CREATE FUNCTION public.apply_guest_program_application(bigint,uuid,text,text,text,jsonb)
            RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
        CREATE FUNCTION public.respond_to_program_session(uuid,uuid,text,jsonb)
            RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
        CREATE FUNCTION public.respond_to_program_session(uuid,uuid,text)
            RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
        CREATE FUNCTION public.apply_guest_program_session(uuid,uuid,text,text,text,jsonb)
            RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
        CREATE FUNCTION public.register_guest_program_application(bigint,uuid,jsonb,jsonb)
            RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
        CREATE FUNCTION public.respond_to_program_application_checked(bigint,uuid,text,jsonb,integer)
            RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
        CREATE FUNCTION public.respond_to_program_session_checked(uuid,uuid,text,jsonb,integer)
            RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
        CREATE FUNCTION public.register_guest_program_application_checked(bigint,uuid,jsonb,jsonb,integer)
            RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
        CREATE VIEW public.member_program_applications AS SELECT NULL::text AS status WHERE false;
        CREATE VIEW public.guest_program_applications AS SELECT NULL::text AS status WHERE false;
        CREATE VIEW public.member_program_session_applications AS SELECT NULL::text AS status WHERE false;
        CREATE VIEW public.guest_program_session_applications AS SELECT NULL::text AS status WHERE false;
        CREATE VIEW public.guest_program_registration_requests AS SELECT NULL::text AS status WHERE false;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon,authenticated;
        GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA public TO anon,authenticated;
    `);
    await db.exec(readFileSync(new URL('../supabase/manual/proposals/20260930_retire_unchecked_program_application_writes.sql', import.meta.url), 'utf8'));
    for (const role of ['anon', 'authenticated']) {
        const old = await db.query(`SELECT has_function_privilege($1,oid,'EXECUTE') AS allowed
            FROM pg_proc WHERE oid IN (
                'public.respond_to_program_application(bigint,uuid,text,jsonb)'::regprocedure,
                'public.apply_guest_program_application(bigint,uuid,text,text,text,jsonb)'::regprocedure,
                'public.respond_to_program_session(uuid,uuid,text,jsonb)'::regprocedure,
                'public.respond_to_program_session(uuid,uuid,text)'::regprocedure,
                'public.apply_guest_program_session(uuid,uuid,text,text,text,jsonb)'::regprocedure,
                'public.register_guest_program_application(bigint,uuid,jsonb,jsonb)'::regprocedure
            )`, [role]);
        assert.equal(old.rows.length, 6);
        assert.ok(old.rows.every(row => row.allowed === false));
        const checked = await db.query(`SELECT has_function_privilege($1,oid,'EXECUTE') AS allowed
            FROM pg_proc WHERE oid IN (
                'public.respond_to_program_application_checked(bigint,uuid,text,jsonb,integer)'::regprocedure,
                'public.respond_to_program_session_checked(uuid,uuid,text,jsonb,integer)'::regprocedure,
                'public.register_guest_program_application_checked(bigint,uuid,jsonb,jsonb,integer)'::regprocedure
            )`, [role]);
        assert.equal(checked.rows.length, 3);
        assert.ok(checked.rows.every(row => row.allowed === true));
        for (const view of ['member_program_applications', 'guest_program_applications',
            'member_program_session_applications', 'guest_program_session_applications',
            'guest_program_registration_requests']) {
            const permission = await db.query(`SELECT
                has_table_privilege($1,$2,'SELECT') AS can_read,
                has_table_privilege($1,$2,'INSERT') AS can_insert`, [role, `public.${view}`]);
            assert.equal(permission.rows[0].can_read, false);
            assert.equal(permission.rows[0].can_insert, false);
        }
    }
    console.log('unchecked program application endpoints revoked; checked endpoints retained');
} finally {
    await db.close();
}
