BEGIN;

-- Authorization has already verified the bearer against the session-reader
-- role. The withdrawal worker repeats the check inside its write transaction,
-- so it must be able to read exactly the verified actor and selected target.
DROP POLICY IF EXISTS member_admin_role_read ON account_security.account_roles;
CREATE POLICY member_admin_role_read
ON account_security.account_roles
FOR SELECT
TO account_member_admin_worker
USING (
    profile_id IN (
        NULLIF(current_setting('app.actor_profile_id', true), '')::uuid,
        NULLIF(current_setting('app.target_profile_id', true), '')::uuid
    )
);

COMMIT;
