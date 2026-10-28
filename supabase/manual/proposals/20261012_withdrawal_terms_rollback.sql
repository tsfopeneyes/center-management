BEGIN;
CREATE OR REPLACE FUNCTION account_security.guard_member_terms_preferences()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE old_terms jsonb := jsonb_build_object(
  'terms_agreed',OLD.preferences->'terms_agreed','terms_version',OLD.preferences->'terms_version',
  'terms_agreed_at',OLD.preferences->'terms_agreed_at','terms_consent_source',OLD.preferences->'terms_consent_source');
DECLARE new_terms jsonb := jsonb_build_object(
  'terms_agreed',NEW.preferences->'terms_agreed','terms_version',NEW.preferences->'terms_version',
  'terms_agreed_at',NEW.preferences->'terms_agreed_at','terms_consent_source',NEW.preferences->'terms_consent_source');
BEGIN
  IF old_terms IS DISTINCT FROM new_terms
     AND current_user NOT IN ('account_profile_worker','account_membership_worker','postgres','supabase_admin') THEN
    RAISE EXCEPTION 'terms_preferences_require_verified_flow' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;

COMMIT;
