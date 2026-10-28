BEGIN;
-- The provider consumes authorization requests on code exchange. Persistent
-- consent, exact live OAuth session, account and client checks remain required.
CREATE OR REPLACE FUNCTION center_integration.apply_access_claims(event jsonb)
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
    JOIN auth.oauth_consents consent ON consent.user_id=connection.auth_user_id AND consent.client_id=connection.client_id
      AND consent.revoked_at IS NULL
    JOIN auth.oauth_clients native_client ON native_client.id=connection.client_id AND native_client.deleted_at IS NULL
    JOIN auth.sessions session ON session.id::text=claims->>'session_id'
      AND session.user_id=connection.auth_user_id AND session.oauth_client_id=connection.client_id
    WHERE setting.singleton AND setting.enabled AND cl.enabled AND cl.retired_at IS NULL
      AND connection.state='active' AND account.mapping_verified=true AND account.status='active'
      AND account.must_change_password=false AND account.credential_version=connection.credential_version
      AND role.enabled=true AND role.role IN ('admin','master')
      AND (session.not_after IS NULL OR session.not_after>now())
      AND claims->>'sub'=connection.auth_user_id::text
      AND connection.profile_id=ANY(setting.pilot_profile_ids)
  ) INTO permitted;
  IF permitted THEN
    claims := claims || jsonb_build_object('center_permissions', to_jsonb(connection.capabilities));
  END IF;
  RETURN jsonb_set(event, '{claims}', claims);
END $body$;
COMMIT;
