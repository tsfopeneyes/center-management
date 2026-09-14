-- Run against a migrated database. Every mutation is rolled back.
BEGIN;

DO $$
DECLARE
    target_id uuid;
    actor_id uuid;
    before_version integer;
    after_version integer;
    public_role text;
    public_master boolean;
    audit_count integer;
    trusted_sessions integer;
BEGIN
    SELECT r.profile_id, a.credential_version
    INTO target_id, before_version
    FROM account_security.account_roles r
    JOIN account_security.accounts a USING (profile_id)
    JOIN public.users u ON u.id = r.profile_id
    WHERE r.enabled IS TRUE
      AND r.role = 'member'
      AND a.mapping_verified IS TRUE
      AND a.status = 'active'
      AND u.status IS DISTINCT FROM 'withdrawn'
    LIMIT 1;

    SELECT profile_id INTO actor_id
    FROM account_security.account_roles
    WHERE enabled IS TRUE AND role = 'master'
    LIMIT 1;

    IF target_id IS NULL OR actor_id IS NULL THEN
        RAISE EXCEPTION 'Role smoke test fixtures are unavailable';
    END IF;

    PERFORM set_config('app.actor_profile_id', actor_id::text, true);
    PERFORM set_config('app.role_change_reason', 'rolled_back_smoke_test', true);

    UPDATE account_security.account_roles
    SET role = 'admin'
    WHERE profile_id = target_id;

    SELECT credential_version INTO after_version
    FROM account_security.accounts WHERE profile_id = target_id;
    SELECT role, is_master INTO public_role, public_master
    FROM public.users WHERE id = target_id;
    SELECT count(*) INTO audit_count
    FROM account_security.account_role_audit
    WHERE profile_id = target_id AND reason = 'rolled_back_smoke_test';
    SELECT count(*) INTO trusted_sessions
    FROM account_security.session_assurances
    WHERE profile_id = target_id AND status = 'trusted';

    IF after_version <> before_version + 1 THEN
        RAISE EXCEPTION 'Credential version was not advanced';
    END IF;
    IF public_role <> 'admin' OR public_master IS TRUE THEN
        RAISE EXCEPTION 'Public compatibility fields were not synchronized';
    END IF;
    IF audit_count <> 1 THEN
        RAISE EXCEPTION 'Role audit was not written exactly once';
    END IF;
    IF trusted_sessions <> 0 THEN
        RAISE EXCEPTION 'Trusted sessions were not revoked';
    END IF;
END;
$$;

ROLLBACK;
