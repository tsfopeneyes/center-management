BEGIN;

-- A password replacement can receive a new token for the same live Auth
-- session_id. Permit the internal login worker to advance only the assurance
-- epoch/status/expiry; identity columns remain immutable.
GRANT UPDATE (credential_version, status, valid_until)
ON account_security.session_assurances TO account_login_worker;

DROP POLICY IF EXISTS login_assurance_refresh
ON account_security.session_assurances;

CREATE POLICY login_assurance_refresh
ON account_security.session_assurances
FOR UPDATE TO account_login_worker
USING (true)
WITH CHECK (status = 'trusted');

COMMIT;
