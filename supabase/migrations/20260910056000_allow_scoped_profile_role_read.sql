-- The profile endpoint returns the canonical role with the signed-in user's
-- own profile. Its database worker may read exactly the role row selected by
-- app.profile_id and nothing else.

BEGIN;

GRANT SELECT (profile_id, role, enabled)
ON account_security.account_roles
TO account_profile_worker;

DROP POLICY IF EXISTS profile_worker_role_read ON account_security.account_roles;
CREATE POLICY profile_worker_role_read
ON account_security.account_roles
FOR SELECT
TO account_profile_worker
USING (
    profile_id = nullif(current_setting('app.profile_id', true), '')::uuid
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'account_security'
          AND tablename = 'account_roles'
          AND policyname = 'profile_worker_role_read'
          AND cmd = 'SELECT'
          AND roles = ARRAY['account_profile_worker']::name[]
    ) THEN
        RAISE EXCEPTION 'scoped profile role policy was not installed';
    END IF;
END;
$$;

COMMIT;
