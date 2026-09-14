-- One authorization model for the whole service.
-- account_security.account_roles is the only authorization source:
--   member = ordinary account
--   admin  = staff
--   master = staff with master privileges
-- public.users.role / is_master remain compatibility display fields only.

BEGIN;

LOCK TABLE account_security.account_roles IN SHARE ROW EXCLUSIVE MODE;

-- Replace the legacy private `staff` value before tightening the enum-like
-- constraint. Production currently contains only member/admin, but keeping
-- this conversion makes the migration safe for older environments as well.
ALTER TABLE account_security.account_roles
    DROP CONSTRAINT IF EXISTS account_roles_role_check;

UPDATE account_security.account_roles
SET role = 'admin'
WHERE role = 'staff';

ALTER TABLE account_security.account_roles
    ADD CONSTRAINT account_roles_role_check
    CHECK (role IN ('member', 'admin', 'master'));

-- This is the one-time cutover from the reviewed legacy master flag. Only an
-- account that is already an enabled private admin can become a master here.
UPDATE account_security.account_roles ar
SET role = 'master'
FROM public.users u
WHERE u.id = ar.profile_id
  AND ar.enabled IS TRUE
  AND ar.role = 'admin'
  AND u.is_master IS TRUE;

CREATE TABLE IF NOT EXISTS account_security.account_role_audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES account_security.accounts(profile_id) ON DELETE RESTRICT,
    old_role text,
    new_role text NOT NULL CHECK (new_role IN ('member', 'admin', 'master')),
    old_enabled boolean,
    new_enabled boolean NOT NULL,
    actor_profile_id uuid REFERENCES account_security.accounts(profile_id) ON DELETE RESTRICT,
    reason text NOT NULL DEFAULT 'account_role_change' CHECK (length(reason) BETWEEN 1 AND 200),
    changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE account_security.account_role_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON account_security.account_role_audit FROM PUBLIC, anon, authenticated;

-- Private helpers are the sole place where an Auth identity is resolved to an
-- application role. Public profile fields are deliberately absent.
CREATE OR REPLACE FUNCTION account_security.current_account_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT r.role
    FROM account_security.accounts a
    JOIN account_security.account_roles r USING (profile_id)
    JOIN public.users u ON u.id = a.profile_id
    WHERE a.auth_user_id = auth.uid()
      AND a.mapping_verified IS TRUE
      AND a.status = 'active'
      AND r.enabled IS TRUE
      AND u.status IS DISTINCT FROM 'withdrawn'
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_current_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT coalesce(account_security.current_account_role() IN ('admin', 'master'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_current_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT coalesce(account_security.current_account_role() = 'master', false);
$$;

REVOKE ALL ON FUNCTION account_security.current_account_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_current_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_master() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_current_master() TO authenticated, service_role;

-- Existing RLS policies already call these two functions. Repointing them is
-- an atomic cutover: calendar/community permissions no longer depend on the
-- legacy calendar_private.admin_identities table.
CREATE OR REPLACE FUNCTION public.calendar_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$ SELECT public.is_current_staff(); $$;

CREATE OR REPLACE FUNCTION public.is_community_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$ SELECT public.is_current_staff(); $$;

COMMENT ON TABLE calendar_private.admin_identities IS
    'Deprecated compatibility data. Authorization uses account_security.account_roles through public.is_current_staff().';

-- Keep non-sensitive public display fields aligned from the canonical private
-- role. There is intentionally no reverse trigger from public.users.
CREATE OR REPLACE FUNCTION account_security.sync_account_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    actor_id uuid := nullif(current_setting('app.actor_profile_id', true), '')::uuid;
    change_reason text := coalesce(nullif(current_setting('app.role_change_reason', true), ''), 'account_role_change');
BEGIN
    IF TG_OP = 'UPDATE'
       AND ROW(OLD.role, OLD.enabled) IS NOT DISTINCT FROM ROW(NEW.role, NEW.enabled) THEN
        RETURN NEW;
    END IF;

    INSERT INTO account_security.account_role_audit(
        profile_id, old_role, new_role, old_enabled, new_enabled, actor_profile_id, reason
    ) VALUES (
        NEW.profile_id,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.role ELSE NULL END,
        NEW.role,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.enabled ELSE NULL END,
        NEW.enabled,
        actor_id,
        left(change_reason, 200)
    );

    IF TG_OP = 'UPDATE' THEN
        UPDATE account_security.accounts
        SET credential_version = credential_version + 1
        WHERE profile_id = NEW.profile_id;

        UPDATE account_security.session_assurances
        SET status = 'revoked'
        WHERE profile_id = NEW.profile_id
          AND status <> 'revoked';
    END IF;

    UPDATE public.users u
    SET role = CASE
            WHEN NEW.enabled AND NEW.role IN ('admin', 'master') THEN 'admin'
            WHEN u.role IN ('admin', 'master', 'staff', 'Rok')
                THEN CASE WHEN u.user_group = '게스트' THEN 'student' ELSE 'user' END
            ELSE u.role
        END,
        is_master = (NEW.enabled AND NEW.role = 'master')
    WHERE u.id = NEW.profile_id;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION account_security.sync_account_role_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_account_role_after_write ON account_security.account_roles;
CREATE TRIGGER sync_account_role_after_write
AFTER INSERT OR UPDATE OF role, enabled ON account_security.account_roles
FOR EACH ROW EXECUTE FUNCTION account_security.sync_account_role_change();

-- Initial compatibility sync is done after the one-time cutover and before the
-- trigger starts handling all future writes. It does not revoke live sessions.
UPDATE public.users u
SET role = 'admin',
    is_master = (r.role = 'master')
FROM account_security.account_roles r
JOIN account_security.accounts a ON a.profile_id = r.profile_id
WHERE u.id = r.profile_id
  AND r.enabled IS TRUE
  AND r.role IN ('admin', 'master')
  AND a.mapping_verified IS TRUE
  AND a.status = 'active'
  AND u.status IS DISTINCT FROM 'withdrawn'
  AND ROW(u.role, u.is_master) IS DISTINCT FROM
      ROW('admin'::text, r.role = 'master');

-- A read-only, non-sensitive directory lets every screen search the exact same
-- canonical staff set without exposing the private security schema.
CREATE OR REPLACE VIEW public.staff_directory
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
    u.id,
    u.name,
    u.school,
    u.user_group,
    u.profile_image_url,
    u.status,
    r.role,
    (r.role = 'master') AS is_master
FROM account_security.account_roles r
JOIN account_security.accounts a USING (profile_id)
JOIN public.users u ON u.id = r.profile_id
WHERE r.enabled IS TRUE
  AND r.role IN ('admin', 'master')
  AND a.mapping_verified IS TRUE
  AND a.status = 'active'
  AND u.status IS DISTINCT FROM 'withdrawn';

REVOKE ALL ON public.staff_directory FROM PUBLIC, anon;
GRANT SELECT ON public.staff_directory TO authenticated, service_role;

-- Role assignment is target-scoped and can save only canonical values. The
-- separate withdrawal policy continues to allow enabled=false for withdrawal.
DROP POLICY IF EXISTS member_admin_role_access ON account_security.account_roles;
CREATE POLICY member_admin_role_access ON account_security.account_roles
    FOR UPDATE TO account_member_admin_worker
    USING (profile_id = nullif(current_setting('app.target_profile_id', true), '')::uuid)
    WITH CHECK (
        profile_id = nullif(current_setting('app.target_profile_id', true), '')::uuid
        AND role IN ('member', 'admin', 'master')
        AND enabled IS TRUE
    );

-- Master accounts are staff too and retain password-reset authority.
DROP POLICY IF EXISTS credential_confirmation_write ON account_security.credential_confirmations;
CREATE POLICY credential_confirmation_write ON account_security.credential_confirmations
    FOR INSERT TO account_confirmation_writer
    WITH CHECK (
        actor_profile_id = nullif(current_setting('app.actor_profile_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM account_security.account_roles r
            WHERE r.profile_id = actor_profile_id
              AND r.enabled IS TRUE
              AND r.role IN ('admin', 'master')
        )
        AND EXISTS (
            SELECT 1 FROM account_security.accounts a
            WHERE a.profile_id = credential_confirmations.profile_id
              AND a.mapping_verified IS TRUE
              AND a.status = 'active'
        )
    );

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM account_security.account_roles
        WHERE role NOT IN ('member', 'admin', 'master')
    ) THEN
        RAISE EXCEPTION 'Non-canonical private account role remains';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM account_security.account_roles r
        LEFT JOIN account_security.accounts a USING (profile_id)
        WHERE r.enabled IS TRUE
          AND r.role IN ('admin', 'master')
          AND (a.profile_id IS NULL OR a.mapping_verified IS NOT TRUE OR a.status <> 'active')
    ) THEN
        RAISE EXCEPTION 'Enabled staff role has no active verified account mapping';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM account_security.account_roles r
        JOIN public.users u ON u.id = r.profile_id
        WHERE r.enabled IS TRUE
          AND r.role IN ('admin', 'master')
          AND ROW(u.role, u.is_master) IS DISTINCT FROM
              ROW('admin'::text, r.role = 'master')
    ) THEN
        RAISE EXCEPTION 'Public compatibility role is out of sync';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM account_security.account_roles
        WHERE enabled IS TRUE AND role = 'master'
    ) THEN
        RAISE EXCEPTION 'At least one active master account is required';
    END IF;
END;
$$;

COMMIT;
