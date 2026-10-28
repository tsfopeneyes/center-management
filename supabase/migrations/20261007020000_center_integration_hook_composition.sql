-- Approved integration rollout: preserve the existing MCP Hook contract.
BEGIN;
CREATE FUNCTION center_integration.composed_access_claims(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
  RETURN center_integration.apply_access_claims(center_mcp.apply_access_claims(event));
END $body$;
REVOKE ALL ON FUNCTION center_integration.composed_access_claims(jsonb)
  FROM PUBLIC, anon, authenticated, center_integration_token;
GRANT EXECUTE ON FUNCTION center_integration.composed_access_claims(jsonb) TO supabase_auth_admin;
COMMIT;
