BEGIN;

GRANT INSERT ON account_security.account_roles TO account_membership_worker;

DROP POLICY IF EXISTS membership_role_insert ON account_security.account_roles;
CREATE POLICY membership_role_insert
ON account_security.account_roles
FOR INSERT
TO account_membership_worker
WITH CHECK (role = 'member' AND enabled);

-- Registrations completed before this fix created the account mapping but
-- omitted the corresponding member role. Only repair active, verified,
-- non-staff member accounts that have no role row at all.
INSERT INTO account_security.account_roles(profile_id, role, enabled)
SELECT a.profile_id, 'member', true
FROM account_security.accounts a
JOIN public.users u ON u.id = a.profile_id
LEFT JOIN account_security.account_roles r ON r.profile_id = a.profile_id
WHERE r.profile_id IS NULL
  AND a.mapping_verified
  AND a.status = 'active'
  AND u.role = 'user'
  AND NOT COALESCE(u.is_master, false)
  AND u.user_group IN ('청소년', '졸업생');

COMMIT;
