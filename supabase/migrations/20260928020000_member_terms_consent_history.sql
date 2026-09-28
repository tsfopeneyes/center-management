BEGIN;

CREATE TABLE account_security.member_terms_consents (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    auth_user_id uuid,
    session_id uuid,
    terms_version text NOT NULL CHECK (length(terms_version) BETWEEN 1 AND 80),
    source text NOT NULL CHECK (source IN ('SIGNUP','WEB_LOGIN','KIOSK','LEGACY_PREFERENCE')),
    art1 boolean NOT NULL, art2 boolean NOT NULL, art3 boolean NOT NULL, art4 boolean NOT NULL,
    accepted_at timestamptz,
    recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(profile_id, terms_version),
    CHECK (art1 AND art2 AND art3 AND art4),
    CHECK ((source = 'LEGACY_PREFERENCE') = (accepted_at IS NULL))
);
ALTER TABLE account_security.member_terms_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON account_security.member_terms_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON account_security.member_terms_consents TO account_profile_worker, account_membership_worker;
GRANT USAGE, SELECT ON SEQUENCE account_security.member_terms_consents_id_seq TO account_profile_worker, account_membership_worker;
CREATE POLICY member_terms_profile_insert ON account_security.member_terms_consents FOR INSERT TO account_profile_worker
WITH CHECK (profile_id = nullif(current_setting('app.profile_id', true), '')::uuid AND source = 'WEB_LOGIN');
CREATE POLICY member_terms_profile_read ON account_security.member_terms_consents FOR SELECT TO account_profile_worker
USING (profile_id = nullif(current_setting('app.profile_id', true), '')::uuid);
CREATE POLICY member_terms_signup_insert ON account_security.member_terms_consents FOR INSERT TO account_membership_worker
WITH CHECK (source = 'SIGNUP');
CREATE POLICY member_terms_signup_read ON account_security.member_terms_consents FOR SELECT TO account_membership_worker
USING (source = 'SIGNUP');

INSERT INTO account_security.member_terms_consents(profile_id,auth_user_id,terms_version,source,art1,art2,art3,art4,accepted_at)
SELECT u.id,a.auth_user_id,u.preferences->>'terms_version','LEGACY_PREFERENCE',true,true,true,true,NULL
FROM public.users u LEFT JOIN account_security.accounts a ON a.profile_id=u.id
WHERE u.preferences->>'terms_agreed'='true' AND length(COALESCE(u.preferences->>'terms_version','')) BETWEEN 1 AND 80
ON CONFLICT(profile_id,terms_version) DO NOTHING;

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
REVOKE ALL ON FUNCTION account_security.guard_member_terms_preferences() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_member_terms_preferences ON public.users;
CREATE TRIGGER guard_member_terms_preferences BEFORE UPDATE OF preferences ON public.users
FOR EACH ROW EXECUTE FUNCTION account_security.guard_member_terms_preferences();

CREATE OR REPLACE FUNCTION public.accept_kiosk_member_terms(p_profile_id uuid,p_terms_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE next_preferences jsonb;
BEGIN
  IF NOT public.is_current_staff() OR p_terms_version<>'2024-03-05' THEN RAISE EXCEPTION 'terms_consent_not_allowed' USING ERRCODE='42501'; END IF;
  UPDATE public.users u SET preferences=COALESCE(u.preferences,'{}'::jsonb)||jsonb_build_object(
    'terms_agreed',true,'terms_version',p_terms_version,'terms_agreed_at',clock_timestamp(),'terms_consent_source','KIOSK')
  WHERE u.id=p_profile_id AND u.status IS DISTINCT FROM 'withdrawn' AND u.user_group NOT IN ('게스트','미가입')
    AND COALESCE((u.preferences->>'is_temporary')::boolean,false)=false RETURNING u.preferences INTO next_preferences;
  IF next_preferences IS NULL THEN RAISE EXCEPTION 'terms_consent_not_allowed' USING ERRCODE='42501'; END IF;
  INSERT INTO account_security.member_terms_consents(profile_id,auth_user_id,terms_version,source,art1,art2,art3,art4,accepted_at)
  VALUES(p_profile_id,auth.uid(),p_terms_version,'KIOSK',true,true,true,true,clock_timestamp())
  ON CONFLICT(profile_id,terms_version) DO NOTHING;
  RETURN next_preferences;
END $$;
REVOKE ALL ON FUNCTION public.accept_kiosk_member_terms(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_kiosk_member_terms(uuid,text) TO authenticated;

COMMIT;
