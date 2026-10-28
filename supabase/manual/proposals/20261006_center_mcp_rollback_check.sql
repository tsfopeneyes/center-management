-- REVIEW PROPOSAL ONLY. Not applied. Transaction can be ended with ROLLBACK
-- for a catalog/privilege dry-run. Never insert real binding values in source.
BEGIN;
CREATE SCHEMA center_mcp;
REVOKE ALL ON SCHEMA center_mcp FROM PUBLIC, anon, authenticated;
CREATE ROLE center_statistics_reader NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE center_mcp_consent_writer NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE center_mcp_release_worker NOLOGIN NOSUPERUSER NOBYPASSRLS;
-- JWT role has no table, schema or function privileges. It is not a DB reader.
CREATE ROLE center_mcp_oauth NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
GRANT center_statistics_reader,center_mcp_consent_writer,center_mcp_release_worker TO postgres;
-- Deliberately NOT a member of authenticator: PostgREST cannot SET ROLE to
-- this JWT role, including calls to PUBLIC-granted SECURITY DEFINER RPCs.
CREATE TABLE center_mcp.configuration (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 client_id uuid UNIQUE, auth_user_id uuid UNIQUE, profile_id uuid UNIQUE,
 credential_version integer CHECK(credential_version>0), enabled boolean NOT NULL DEFAULT false,
 publication_policy jsonb NOT NULL DEFAULT '{"reviewed":false}'::jsonb,
 CHECK(NOT enabled OR (client_id IS NOT NULL AND auth_user_id IS NOT NULL AND profile_id IS NOT NULL AND credential_version IS NOT NULL))
);
INSERT INTO center_mcp.configuration(singleton,client_id) VALUES(true,'914be882-969c-408f-9609-57a3534cc9b5');
CREATE TABLE center_mcp.consent_proofs (
 authorization_id text PRIMARY KEY, client_id uuid NOT NULL, auth_user_id uuid NOT NULL,
 profile_id uuid NOT NULL, website_session_id uuid NOT NULL, credential_version integer NOT NULL CHECK(credential_version>0),
 created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
REVOKE ALL ON ALL TABLES IN SCHEMA center_mcp FROM PUBLIC,anon,authenticated;
CREATE TABLE center_mcp.published_statistics (
 signature text NOT NULL, policy_id text NOT NULL, window_start timestamptz NOT NULL,
 window_end timestamptz NOT NULL CHECK(window_end>window_start), payload jsonb NOT NULL,
 PRIMARY KEY(signature,policy_id)
);
REVOKE ALL ON center_mcp.published_statistics FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA center_mcp TO center_mcp_release_worker;
GRANT SELECT,INSERT ON center_mcp.published_statistics TO center_mcp_release_worker;
GRANT USAGE ON SCHEMA public,account_security,center_mcp,auth TO center_statistics_reader;
GRANT SELECT(id,user_group) ON public.users TO center_statistics_reader;
GRANT SELECT(id,role) ON public.staff_directory TO center_statistics_reader;
GRANT SELECT(id) ON public.locations TO center_statistics_reader;
GRANT SELECT(id,user_id,type,location_id,created_at) ON public.logs TO center_statistics_reader;
GRANT SELECT(id,category,program_date,created_at,program_status,is_recruiting) ON public.notices TO center_statistics_reader;
GRANT SELECT(notice_id,user_id,status,is_attended,is_staff) ON public.notice_responses TO center_statistics_reader;
GRANT SELECT(id,notice_id,session_date,status,voided_at) ON public.daily_program_sessions TO center_statistics_reader;
GRANT SELECT(session_id,user_id,status,is_attended) ON public.daily_program_session_responses TO center_statistics_reader;
GRANT SELECT(notice_id,user_id,attendance_date) ON public.open_program_attendance TO center_statistics_reader;
GRANT SELECT(auth_user_id,profile_id,mapping_verified,status,must_change_password,credential_version)
 ON account_security.accounts TO center_statistics_reader,center_mcp_consent_writer;
GRANT SELECT(profile_id,role,enabled) ON account_security.account_roles TO center_statistics_reader,center_mcp_consent_writer;
GRANT SELECT ON center_mcp.configuration,center_mcp.consent_proofs TO center_statistics_reader;
GRANT SELECT(id,user_id,oauth_client_id,created_at,not_after) ON auth.sessions TO center_statistics_reader;
GRANT SELECT(id,deleted_at) ON auth.oauth_clients TO center_statistics_reader;
GRANT SELECT(user_id,client_id,granted_at,revoked_at) ON auth.oauth_consents TO center_statistics_reader;
GRANT SELECT(authorization_id,client_id,user_id,status,approved_at) ON auth.oauth_authorizations TO center_statistics_reader;
GRANT USAGE ON SCHEMA account_security,center_mcp,auth TO center_mcp_consent_writer;
GRANT SELECT ON center_mcp.configuration TO center_mcp_consent_writer;
GRANT INSERT(authorization_id,client_id,auth_user_id,profile_id,website_session_id,credential_version),SELECT(authorization_id)
 ON center_mcp.consent_proofs TO center_mcp_consent_writer;
GRANT SELECT(session_id,auth_user_id,profile_id,credential_version,status) ON account_security.session_assurances TO center_mcp_consent_writer;
GRANT SELECT(authorization_id,client_id,user_id,status,expires_at,redirect_uri,resource,code_challenge_method)
 ON auth.oauth_authorizations TO center_mcp_consent_writer;
-- Existing policies are not changed. Additive role-specific SELECT policies
-- do not grant anon/authenticated any new rights. Restrictive policies, if any,
-- still apply and must be examined in the impact check.
DO $block$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','locations','logs','notices','notice_responses','daily_program_sessions','daily_program_session_responses','open_program_attendance'] LOOP
  EXECUTE format('CREATE POLICY center_mcp_read ON public.%I FOR SELECT TO center_statistics_reader USING (true)',t);
 END LOOP;
END $block$;

CREATE POLICY center_mcp_bound_account ON account_security.accounts FOR SELECT TO center_statistics_reader,center_mcp_consent_writer
 USING (EXISTS(SELECT 1 FROM center_mcp.configuration c WHERE c.singleton AND c.enabled AND c.auth_user_id=accounts.auth_user_id AND c.profile_id=accounts.profile_id));
CREATE POLICY center_mcp_bound_role ON account_security.account_roles FOR SELECT TO center_statistics_reader,center_mcp_consent_writer
 USING (EXISTS(SELECT 1 FROM center_mcp.configuration c WHERE c.singleton AND c.enabled AND c.profile_id=account_roles.profile_id));
CREATE POLICY center_mcp_bound_assurance ON account_security.session_assurances FOR SELECT TO center_mcp_consent_writer
 USING (EXISTS(SELECT 1 FROM center_mcp.configuration c WHERE c.singleton AND c.enabled AND c.auth_user_id=session_assurances.auth_user_id AND c.profile_id=session_assurances.profile_id));
CREATE POLICY center_mcp_native_session ON auth.sessions FOR SELECT TO center_statistics_reader
 USING (EXISTS(SELECT 1 FROM center_mcp.configuration c WHERE c.singleton AND c.enabled AND c.auth_user_id=sessions.user_id AND c.client_id=sessions.oauth_client_id));
CREATE POLICY center_mcp_native_client ON auth.oauth_clients FOR SELECT TO center_statistics_reader
 USING (EXISTS(SELECT 1 FROM center_mcp.configuration c WHERE c.singleton AND c.enabled AND c.client_id=oauth_clients.id));
CREATE POLICY center_mcp_native_consent ON auth.oauth_consents FOR SELECT TO center_statistics_reader
 USING (EXISTS(SELECT 1 FROM center_mcp.configuration c WHERE c.singleton AND c.enabled AND c.auth_user_id=oauth_consents.user_id AND c.client_id=oauth_consents.client_id));
CREATE POLICY center_mcp_native_authorization ON auth.oauth_authorizations FOR SELECT TO center_statistics_reader,center_mcp_consent_writer
 USING (EXISTS(SELECT 1 FROM center_mcp.configuration c WHERE c.singleton AND c.enabled AND c.client_id=oauth_authorizations.client_id AND (oauth_authorizations.user_id IS NULL OR c.auth_user_id=oauth_authorizations.user_id)));

-- Composable transformer: an existing hook's vetted output claims can be fed
-- into this function. Do not activate by replacing an existing hook blindly.
CREATE FUNCTION center_mcp.apply_access_claims(event jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE c center_mcp.configuration%ROWTYPE; claims jsonb:=event->'claims'; permitted boolean:=false;
BEGIN
 SELECT * INTO c FROM center_mcp.configuration WHERE singleton=true;
 IF coalesce(event->>'client_id',claims->>'client_id') IS DISTINCT FROM '914be882-969c-408f-9609-57a3534cc9b5' THEN RETURN event; END IF;
 -- Even disabled/wrong-user dedicated tokens never retain broad website role.
 claims:=claims || jsonb_build_object('aud','https://erecqalsxoxrufggvmcc.supabase.co/functions/v1/center-statistics-mcp',
   'role','center_mcp_oauth','client_id','914be882-969c-408f-9609-57a3534cc9b5','center_permissions','[]'::jsonb,'center_credential_version',null);
 IF c.enabled AND claims->>'sub'=c.auth_user_id::text THEN
  SELECT EXISTS(SELECT 1 FROM account_security.accounts a
   JOIN account_security.account_roles r ON r.profile_id=a.profile_id
   JOIN center_mcp.consent_proofs p ON p.auth_user_id=a.auth_user_id AND p.profile_id=a.profile_id
   JOIN auth.oauth_authorizations oa ON oa.authorization_id=p.authorization_id AND oa.client_id=p.client_id AND oa.user_id=p.auth_user_id
   JOIN auth.sessions os ON os.id::text=claims->>'session_id' AND os.user_id=p.auth_user_id AND os.oauth_client_id=p.client_id
   WHERE a.auth_user_id=c.auth_user_id AND a.profile_id=c.profile_id AND a.mapping_verified=true AND a.status='active'
    AND a.must_change_password=false AND a.credential_version=c.credential_version AND r.enabled=true AND r.role IN ('admin','master')
    AND p.client_id=c.client_id AND p.credential_version=c.credential_version AND p.revoked_at IS NULL
    AND oa.status::text='approved' AND oa.approved_at IS NOT NULL
    AND os.created_at BETWEEN oa.approved_at - interval '5 seconds' AND oa.approved_at + interval '30 seconds') INTO permitted;
 END IF;
 IF permitted THEN claims:=claims || jsonb_build_object('center_permissions',jsonb_build_array('center:statistics:read','center:programs:read'),
   'center_credential_version',c.credential_version); END IF;
 RETURN jsonb_set(event,'{claims}',claims);
END $body$;
REVOKE ALL ON FUNCTION center_mcp.apply_access_claims(jsonb) FROM PUBLIC,anon,authenticated,center_mcp_oauth;
GRANT USAGE ON SCHEMA center_mcp TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION center_mcp.apply_access_claims(jsonb) TO supabase_auth_admin;
-- No runtime role may configure/enable the binding or change privacy policy.
ROLLBACK;