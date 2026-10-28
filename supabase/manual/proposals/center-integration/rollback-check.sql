-- REVIEW PROPOSAL ONLY.  Do not copy this file into supabase/migrations or run
-- db push until the P0 evidence in docs/center-integration/validation.md is
-- complete, impact checks pass, and the user explicitly approves production
-- schema changes.  This proposal is additive and defaults every integration
-- switch to disabled.
BEGIN;

CREATE SCHEMA center_integration;
REVOKE ALL ON SCHEMA center_integration FROM PUBLIC, anon, authenticated;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='center_integration_reader') THEN
    CREATE ROLE center_integration_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='center_integration_control_writer') THEN
    CREATE ROLE center_integration_control_writer NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='center_integration_token') THEN
    CREATE ROLE center_integration_token NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END $roles$;

-- The platform service connection may SET LOCAL to the two service roles.  The
-- OAuth JWT role deliberately is not granted to authenticator or any data role.
GRANT center_integration_reader, center_integration_control_writer TO postgres;

CREATE TABLE center_integration.settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  pilot_profile_ids uuid[] NOT NULL DEFAULT '{}',
  disclosure_version text NOT NULL DEFAULT '2026-10-v1' CHECK (length(disclosure_version) BETWEEN 1 AND 128),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO center_integration.settings(singleton, enabled)
VALUES (true, false)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE center_integration.clients (
  client_id uuid PRIMARY KEY,
  client_label text NOT NULL CHECK (length(client_label) BETWEEN 1 AND 160),
  resource text NOT NULL CHECK (resource ~ '^https://'),
  issuer text NOT NULL CHECK (issuer ~ '^https://'),
  redirect_uris text[] NOT NULL CHECK (cardinality(redirect_uris) > 0),
  enabled boolean NOT NULL DEFAULT false,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(resource, client_id)
);

CREATE TABLE center_integration.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES center_integration.clients(client_id),
  state text NOT NULL CHECK (state IN ('pending','active','revoke_pending','revoked')),
  capabilities text[] NOT NULL CHECK (
    cardinality(capabilities) > 0
    AND capabilities <@ ARRAY['analytics.read','programs.read']::text[]
  ),
  native_authorization_id text,
  grant_version integer NOT NULL CHECK (grant_version > 0),
  credential_version integer NOT NULL CHECK (credential_version > 0),
  consented_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(auth_user_id, client_id),
  CHECK ((state='active' AND native_authorization_id IS NOT NULL AND consented_at IS NOT NULL)
      OR state <> 'active')
);
CREATE INDEX center_integration_connections_token_lookup
  ON center_integration.connections(id, auth_user_id, client_id, grant_version, credential_version)
  WHERE state='active';

CREATE TABLE center_integration.consent_requests (
  id uuid PRIMARY KEY,
  authorization_id text NOT NULL UNIQUE CHECK (authorization_id ~ '^[A-Za-z0-9_-]{1,512}$'),
  connection_id uuid NOT NULL REFERENCES center_integration.connections(id),
  auth_user_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES center_integration.clients(client_id),
  redirect_uri text NOT NULL CHECK (redirect_uri ~ '^https://'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX center_integration_consent_requests_lookup
  ON center_integration.consent_requests(id, auth_user_id, profile_id)
  WHERE completed_at IS NULL;

CREATE TABLE center_integration.external_identities (
  channel text NOT NULL CHECK (channel IN ('slack')),
  team_id text NOT NULL CHECK (length(team_id) BETWEEN 1 AND 128),
  external_user_id text NOT NULL CHECK (length(external_user_id) BETWEEN 1 AND 128),
  profile_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(channel, team_id, external_user_id)
);

CREATE TABLE center_integration.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL CHECK (length(request_id) BETWEEN 1 AND 128),
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 1 AND 80),
  connection_id uuid,
  auth_user_id uuid,
  profile_id uuid,
  channel text NOT NULL CHECK (channel IN ('web','mcp','slack','system')),
  outcome text NOT NULL CHECK (outcome IN ('allowed','denied','error')),
  code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX center_integration_audit_lookup ON center_integration.audit_events(connection_id, created_at DESC);

-- This is controlled operational evidence, not an inferred min/max timestamp.
-- No empty or legacy range is declared complete by default.
CREATE TABLE center_integration.source_coverage (
  domain text PRIMARY KEY CHECK (domain IN ('logs','programs','feedback','rentals','store','surveys')),
  status text NOT NULL CHECK (status IN ('complete','limited','unknown')) DEFAULT 'unknown',
  start_day date,
  end_exclusive date,
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((start_day IS NULL AND end_exclusive IS NULL) OR (start_day IS NOT NULL AND end_exclusive IS NOT NULL AND start_day < end_exclusive))
);

CREATE TABLE center_integration.program_catalog (
  program_ref text PRIMARY KEY CHECK (program_ref ~ '^[A-Za-z0-9._:-]{1,64}$'),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  scheduled_date date,
  recruitment_status text NOT NULL CHECK (recruitment_status IN ('open','closed','unknown')),
  public_description text CHECK (length(public_description) <= 2000),
  published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE center_integration.runtime_state (
  key text PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 300),
  value jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

REVOKE ALL ON ALL TABLES IN SCHEMA center_integration FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA center_integration FROM PUBLIC, anon, authenticated;

-- Private source views expose only fields needed for server-side,
-- parameterized calculation.  They are never exposed through PostgREST.  Their
-- owner/`security_invoker` behaviour must be verified in the isolated ACL
-- check before this proposal is promoted to a migration.
CREATE VIEW center_integration.analysis_users WITH (security_barrier=true) AS
  SELECT id, user_group FROM public.users;
CREATE VIEW center_integration.analysis_staff WITH (security_barrier=true) AS
  SELECT id, role FROM public.staff_directory;
CREATE VIEW center_integration.analysis_locations WITH (security_barrier=true) AS
  SELECT id FROM public.locations;
CREATE VIEW center_integration.analysis_logs WITH (security_barrier=true) AS
  SELECT id, user_id, type, location_id, created_at FROM public.logs;
CREATE VIEW center_integration.analysis_notices WITH (security_barrier=true) AS
  SELECT id, category, program_date, created_at, program_status, is_recruiting FROM public.notices;
CREATE VIEW center_integration.analysis_notice_responses WITH (security_barrier=true) AS
  SELECT notice_id, user_id, status, is_attended, is_staff FROM public.notice_responses;
CREATE VIEW center_integration.analysis_program_sessions WITH (security_barrier=true) AS
  SELECT id, notice_id, session_date, status, voided_at FROM public.daily_program_sessions;
CREATE VIEW center_integration.analysis_program_session_responses WITH (security_barrier=true) AS
  SELECT session_id, user_id, status, is_attended FROM public.daily_program_session_responses;
CREATE VIEW center_integration.analysis_open_program_attendance WITH (security_barrier=true) AS
  SELECT notice_id, user_id, attendance_date FROM public.open_program_attendance;
CREATE VIEW center_integration.analysis_rental_bookings WITH (security_barrier=true) AS
  SELECT id, booking_date, status FROM public.rental_bookings;
CREATE VIEW center_integration.analysis_store_orders WITH (security_barrier=true) AS
  SELECT id, created_at, status FROM public.store_orders;
CREATE VIEW center_integration.analysis_checkin_surveys WITH (security_barrier=true) AS
  SELECT id, created_at, survey_type FROM public.checkin_surveys WHERE aggregation_excluded IS NOT TRUE;

-- Only declared numeric satisfaction values leave the view.  Legacy custom
-- feedback configurations are withheld until a reviewed extractor handles the
-- versioned question key; their synthetic q3 defaults are never counted.
CREATE VIEW center_integration.analysis_satisfaction_facts WITH (security_barrier=true) AS
  SELECT e.id::text AS id,
         e.notice_id::text AS program_ref,
         (e.answers ->> (question.value ->> 'id'))::numeric::integer AS value,
         e.created_at AS submitted_at
    FROM public.survey_entries e
    JOIN public.survey_versions v ON v.id=e.version_id
    CROSS JOIN LATERAL jsonb_array_elements(v.definition->'questions') AS question(value)
   WHERE e.notice_id IS NOT NULL
     AND e.aggregation_excluded IS NOT TRUE
     AND question.value->>'metric'='satisfaction'
     AND question.value->>'type'='star'
      AND coalesce(e.answers ->> (question.value ->> 'id'), '') ~ '^[1-5](\.0+)?$'
  UNION ALL
  SELECT f.id::text AS id,
         f.notice_id::text AS program_ref,
         f.q3_satisfaction AS value,
         f.created_at AS submitted_at
    FROM public.program_feedback f
    LEFT JOIN public.notices n ON n.id=f.notice_id
   WHERE f.aggregation_excluded IS NOT TRUE
     AND f.q3_satisfaction BETWEEN 1 AND 5
     AND (jsonb_typeof(n.guest_properties->'custom_feedback_config'->'questions') IS DISTINCT FROM 'array'
          OR jsonb_array_length(n.guest_properties->'custom_feedback_config'->'questions')=0);

GRANT USAGE ON SCHEMA center_integration, account_security, auth TO center_integration_reader, center_integration_control_writer;
GRANT SELECT ON center_integration.analysis_users, center_integration.analysis_staff,
  center_integration.analysis_locations, center_integration.analysis_logs,
  center_integration.analysis_notices, center_integration.analysis_notice_responses,
  center_integration.analysis_program_sessions, center_integration.analysis_program_session_responses,
  center_integration.analysis_open_program_attendance, center_integration.analysis_satisfaction_facts,
  center_integration.analysis_rental_bookings, center_integration.analysis_store_orders,
  center_integration.analysis_checkin_surveys, center_integration.source_coverage,
  center_integration.program_catalog
TO center_integration_reader;
GRANT SELECT(enabled, pilot_profile_ids) ON center_integration.settings TO center_integration_reader;
GRANT SELECT(id,auth_user_id,profile_id,client_id,state,capabilities,native_authorization_id,grant_version,credential_version)
ON center_integration.connections TO center_integration_reader;
GRANT SELECT(auth_user_id,profile_id,mapping_verified,status,credential_version,must_change_password)
ON account_security.accounts TO center_integration_reader;
GRANT SELECT(profile_id,role,enabled) ON account_security.account_roles TO center_integration_reader;
GRANT SELECT(authorization_id,client_id,user_id,status,resource,redirect_uri,code_challenge_method,expires_at)
ON auth.oauth_authorizations TO center_integration_reader;
GRANT SELECT(user_id,client_id,revoked_at) ON auth.oauth_consents TO center_integration_reader;
GRANT SELECT(id,user_id,oauth_client_id,not_after) ON auth.sessions TO center_integration_reader;
GRANT SELECT(id,deleted_at) ON auth.oauth_clients TO center_integration_reader;

GRANT SELECT, INSERT, UPDATE ON center_integration.connections, center_integration.consent_requests,
  center_integration.audit_events, center_integration.runtime_state
TO center_integration_control_writer;
GRANT SELECT ON center_integration.settings, center_integration.clients TO center_integration_control_writer;
GRANT SELECT(auth_user_id,profile_id,mapping_verified,status,credential_version,must_change_password)
ON account_security.accounts TO center_integration_control_writer;
GRANT SELECT(profile_id,role,enabled) ON account_security.account_roles TO center_integration_control_writer;
GRANT SELECT(authorization_id,client_id,user_id,status,resource,redirect_uri,code_challenge_method,expires_at)
ON auth.oauth_authorizations TO center_integration_control_writer;

-- No table, schema, function, or role membership is granted to the JWT role.
REVOKE ALL ON SCHEMA center_integration, public, account_security, auth FROM center_integration_token;

CREATE FUNCTION center_integration.prevent_connection_reactivation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
  IF OLD.state='revoke_pending' AND NEW.state IN ('active','pending') THEN
    RAISE EXCEPTION 'Native revocation must finish before reconnecting';
  END IF;
  IF OLD.state='revoked' AND NEW.state='pending' AND OLD.native_authorization_id IS NOT NULL THEN
    RAISE EXCEPTION 'Native authorization reference must be cleared before reconnecting';
  END IF;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION center_integration.prevent_connection_reactivation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER center_integration_connection_transition
  BEFORE UPDATE OF state, native_authorization_id ON center_integration.connections
  FOR EACH ROW EXECUTE FUNCTION center_integration.prevent_connection_reactivation();

-- Account disablement, credential changes, and role downgrades make the local
-- grant unusable before any external native grant reconciliation is attempted.
CREATE FUNCTION center_integration.invalidate_changed_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
  IF NEW.mapping_verified IS NOT TRUE OR NEW.status <> 'active' OR NEW.must_change_password IS TRUE
     OR NEW.credential_version <> OLD.credential_version THEN
    UPDATE center_integration.connections
       SET state='revoke_pending', grant_version=grant_version+1, revoked_at=coalesce(revoked_at,now()), updated_at=now()
     WHERE auth_user_id=NEW.auth_user_id AND state IN ('active','pending');
  END IF;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION center_integration.invalidate_changed_account() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER center_integration_account_invalidation
  AFTER UPDATE OF mapping_verified, status, must_change_password, credential_version
  ON account_security.accounts FOR EACH ROW EXECUTE FUNCTION center_integration.invalidate_changed_account();

CREATE FUNCTION center_integration.invalidate_changed_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
  IF NEW.enabled IS NOT TRUE OR NEW.role NOT IN ('admin','master') THEN
    UPDATE center_integration.connections c
       SET state='revoke_pending', grant_version=c.grant_version+1, revoked_at=coalesce(c.revoked_at,now()), updated_at=now()
      FROM account_security.accounts a
     WHERE a.profile_id=NEW.profile_id AND c.auth_user_id=a.auth_user_id AND c.state IN ('active','pending');
  END IF;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION center_integration.invalidate_changed_role() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER center_integration_role_invalidation
  AFTER UPDATE OF enabled, role ON account_security.account_roles
  FOR EACH ROW EXECUTE FUNCTION center_integration.invalidate_changed_role();

-- Candidate Custom Access Token Hook.  The native OAuth server owns code,
-- PKCE, refresh-token rotation, and client registration.  This function only
-- narrows claims for a recognized integration client.  P0 must prove the
-- exact event.client_id / claims.session_id shape before configuring it as the
-- active Auth hook; this proposal does not alter auth.hook configuration.
CREATE FUNCTION center_integration.apply_access_claims(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE
  claims jsonb := event->'claims';
  selected_client uuid;
  connection center_integration.connections%ROWTYPE;
  permitted boolean := false;
BEGIN
  IF claims IS NULL OR jsonb_typeof(claims) <> 'object' THEN RETURN event; END IF;
  BEGIN
    selected_client := nullif(coalesce(event->>'client_id', claims->>'client_id'), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN event;
  END;
  IF selected_client IS NULL THEN
    BEGIN
      selected_client := (
        SELECT s.oauth_client_id
        FROM auth.sessions s
        WHERE s.id::text=claims->>'session_id' AND s.user_id::text=claims->>'sub'
      );
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN event;
    END;
  END IF;
  IF coalesce(claims->>'sub','') !~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$' THEN
    RETURN event;
  END IF;
  -- Isolate every recognized client token, even before local consent exists.
  -- An absent connection must never leave the provider's broad default role.
  IF NOT EXISTS (SELECT 1 FROM center_integration.clients WHERE client_id=selected_client) THEN
    RETURN event;
  END IF;
  claims := claims || jsonb_build_object(
    'aud', (SELECT resource FROM center_integration.clients WHERE client_id=selected_client),
    'role', 'center_integration_token',
    'center_permissions', '[]'::jsonb
  );
  SELECT c.* INTO connection
  FROM center_integration.connections c
  JOIN center_integration.clients cl ON cl.client_id=c.client_id
  WHERE c.client_id=selected_client AND c.auth_user_id=(claims->>'sub')::uuid;
  IF NOT FOUND THEN RETURN jsonb_set(event, '{claims}', claims); END IF;

  -- A token for any known integration client is never a broad PostgREST token.
  claims := claims || jsonb_build_object(
    'aud', (SELECT resource FROM center_integration.clients WHERE client_id=selected_client),
    'role', 'center_integration_token',
    'center_permissions', '[]'::jsonb,
    'center_connection_id', connection.id::text,
    'center_grant_version', connection.grant_version,
    'center_credential_version', connection.credential_version
  );

  SELECT EXISTS (
    SELECT 1
    FROM center_integration.settings setting
    JOIN center_integration.clients cl ON cl.client_id=connection.client_id
    JOIN account_security.accounts account ON account.auth_user_id=connection.auth_user_id AND account.profile_id=connection.profile_id
    JOIN account_security.account_roles role ON role.profile_id=connection.profile_id
    JOIN auth.oauth_authorizations native_auth ON native_auth.authorization_id=connection.native_authorization_id
      AND native_auth.user_id=connection.auth_user_id AND native_auth.client_id=connection.client_id
    JOIN auth.oauth_consents consent ON consent.user_id=connection.auth_user_id AND consent.client_id=connection.client_id
      AND consent.revoked_at IS NULL
    JOIN auth.oauth_clients native_client ON native_client.id=connection.client_id AND native_client.deleted_at IS NULL
    JOIN auth.sessions session ON session.id::text=claims->>'session_id'
      AND session.user_id=connection.auth_user_id AND session.oauth_client_id=connection.client_id
    WHERE setting.singleton AND setting.enabled AND cl.enabled AND cl.retired_at IS NULL
      AND connection.state='active' AND account.mapping_verified=true AND account.status='active'
      AND account.must_change_password=false AND account.credential_version=connection.credential_version
      AND role.enabled=true AND role.role IN ('admin','master')
      AND native_auth.status::text='approved'
      AND (session.not_after IS NULL OR session.not_after>now())
      AND claims->>'sub'=connection.auth_user_id::text
      AND connection.profile_id=ANY(setting.pilot_profile_ids)
  ) INTO permitted;
  IF permitted THEN
    claims := claims || jsonb_build_object('center_permissions', to_jsonb(connection.capabilities));
  END IF;
  RETURN jsonb_set(event, '{claims}', claims);
END $body$;
REVOKE ALL ON FUNCTION center_integration.apply_access_claims(jsonb) FROM PUBLIC, anon, authenticated, center_integration_token;
GRANT USAGE ON SCHEMA center_integration TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION center_integration.apply_access_claims(jsonb) TO supabase_auth_admin;

ROLLBACK;
SELECT to_regnamespace('center_integration') IS NULL AS schema_rolled_back;
