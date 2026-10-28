-- Provider-owned auth schema cannot grant USAGE to custom roles through this
-- management connection. Fixed private projections avoid widening that schema.
BEGIN;
CREATE VIEW center_integration.auth_sessions WITH (security_barrier=true) AS
  SELECT id,user_id,oauth_client_id,not_after FROM auth.sessions;
CREATE VIEW center_integration.auth_clients WITH (security_barrier=true) AS
  SELECT id,deleted_at FROM auth.oauth_clients;
CREATE VIEW center_integration.auth_authorizations WITH (security_barrier=true) AS
  SELECT authorization_id,client_id,user_id,status,resource,redirect_uri,code_challenge_method,expires_at FROM auth.oauth_authorizations;
CREATE VIEW center_integration.auth_consents WITH (security_barrier=true) AS
  SELECT user_id,client_id,revoked_at FROM auth.oauth_consents;
CREATE VIEW center_integration.account_state WITH (security_barrier=true) AS
  SELECT auth_user_id,profile_id,mapping_verified,status,credential_version,must_change_password FROM account_security.accounts;
CREATE VIEW center_integration.account_roles WITH (security_barrier=true) AS
  SELECT profile_id,role,enabled FROM account_security.account_roles;
REVOKE ALL ON center_integration.auth_sessions,center_integration.auth_clients,
  center_integration.auth_authorizations,center_integration.auth_consents,
  center_integration.account_state,center_integration.account_roles FROM PUBLIC,anon,authenticated,center_integration_token;
GRANT SELECT ON center_integration.auth_sessions,center_integration.auth_clients,
  center_integration.auth_authorizations,center_integration.auth_consents,
  center_integration.account_state,center_integration.account_roles
  TO center_integration_reader,center_integration_control_writer;
COMMIT;
