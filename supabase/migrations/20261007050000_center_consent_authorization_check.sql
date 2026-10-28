BEGIN;
-- PostgreSQL bounds regex repetitions at 255. Keep the same alphabet and
-- length policy using separate checks, without touching stored requests.
ALTER TABLE center_integration.consent_requests
    DROP CONSTRAINT consent_requests_authorization_id_check;
ALTER TABLE center_integration.consent_requests
    ADD CONSTRAINT consent_requests_authorization_id_check
    CHECK (length(authorization_id) BETWEEN 1 AND 512
           AND authorization_id ~ '^[A-Za-z0-9_-]+$');
COMMIT;
