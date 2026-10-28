-- Guest convenience credentials join the existing native Auth/session pipeline.
-- Member credentials, profile IDs and program/community records remain intact.
BEGIN;
CREATE ROLE account_guest_login_worker NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
GRANT account_guest_login_worker TO postgres;
GRANT USAGE ON SCHEMA public,account_security TO account_guest_login_worker;
ALTER TABLE account_security.login_identifiers DROP CONSTRAINT login_identifiers_credential_mode_check;
ALTER TABLE account_security.login_identifiers ADD CONSTRAINT login_identifiers_credential_mode_check
 CHECK(credential_mode IN('legacy_pending','legacy_bridge','supabase_password','guest_phone_pin'));

-- Private enrollment prevents changing a member's public group into Guest from
-- turning their member account into a phone-PIN account. Historical rows remain
-- after guest conversion, withdrawal or merging.
CREATE TABLE account_security.guest_login_profiles(
 profile_id uuid PRIMARY KEY,profile_created_at timestamptz NOT NULL,
 legacy_auth_user_id uuid,registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 enabled boolean NOT NULL DEFAULT true,revoked_at timestamptz
);
CREATE TABLE account_security.guest_login_provisions(
 profile_id uuid PRIMARY KEY,operation_id uuid NOT NULL UNIQUE,
 login_email text NOT NULL UNIQUE,state text NOT NULL DEFAULT 'reserved' CHECK(state IN('reserved','creating','ready')),
 auth_user_id uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),claim_started_at timestamptz,ready_at timestamptz
);
CREATE TABLE account_security.guest_login_claims(
 id uuid PRIMARY KEY,profile_id uuid NOT NULL,phone_fingerprint text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '2 minutes',
 consumed_at timestamptz
);
ALTER TABLE account_security.guest_login_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_security.guest_login_provisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_security.guest_login_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON account_security.guest_login_profiles,account_security.guest_login_provisions,account_security.guest_login_claims
 FROM PUBLIC,anon,authenticated,service_role,account_guest_login_worker;

INSERT INTO account_security.guest_login_profiles(profile_id,profile_created_at,legacy_auth_user_id)
 SELECT u.id,u.created_at,u.auth_user_id FROM public.users u
 LEFT JOIN account_security.account_roles r ON r.profile_id=u.id
 WHERE u.user_group='게스트' AND u.status IS DISTINCT FROM 'withdrawn' AND u.status IS DISTINCT FROM 'deleted'
 AND lower(COALESCE(u.role,'')) NOT IN('admin','master','manager','staff','rok') AND NOT COALESCE(u.is_master,false)
 AND (r.profile_id IS NULL OR (r.role='member' AND r.enabled))
 AND NOT EXISTS(SELECT 1 FROM account_security.membership_receipts mr WHERE mr.profile_id=u.id);

CREATE FUNCTION account_security.track_guest_login_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.user_group='게스트' AND NEW.auth_user_id IS NULL
      AND lower(COALESCE(NEW.role,'')) NOT IN('admin','master','manager','staff','rok') AND NOT COALESCE(NEW.is_master,false)
      AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=NEW.id)
      AND NOT EXISTS(SELECT 1 FROM account_security.accounts WHERE profile_id=NEW.id) THEN
     INSERT INTO account_security.guest_login_profiles(profile_id,profile_created_at)
       VALUES(NEW.id,NEW.created_at) ON CONFLICT(profile_id) DO NOTHING;
   END IF;
   RETURN NEW;
 ELSIF TG_OP='DELETE' THEN
   UPDATE account_security.guest_login_profiles SET enabled=false,revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE profile_id=OLD.id;
   RETURN OLD;
 ELSE
   IF NEW.user_group IS DISTINCT FROM '게스트' OR NEW.status IN('withdrawn','deleted') THEN
     UPDATE account_security.guest_login_profiles SET enabled=false,revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE profile_id=OLD.id;
   END IF;
   RETURN NEW;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION account_security.track_guest_login_profile() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER track_guest_login_profile AFTER INSERT OR UPDATE OF user_group,status OR DELETE ON public.users
 FOR EACH ROW EXECUTE FUNCTION account_security.track_guest_login_profile();

CREATE FUNCTION account_security.guest_login_candidates(p_name text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM (
 SELECT u.id::text AS "profileId",u.name,u.school,u.user_group AS "userGroup"
 FROM account_security.guest_login_profiles g JOIN public.users u ON u.id=g.profile_id AND u.created_at=g.profile_created_at
 LEFT JOIN account_security.accounts a ON a.profile_id=u.id LEFT JOIN account_security.account_roles r ON r.profile_id=u.id
 WHERE g.enabled AND g.revoked_at IS NULL AND u.user_group='게스트' AND u.status IS DISTINCT FROM 'withdrawn' AND u.status IS DISTINCT FROM 'deleted'
 AND regexp_replace(COALESCE(u.phone,''),'[^0-9]','','g') ~ '^01[0-9]{8,9}$'
 AND lower(normalize(regexp_replace(btrim(u.name),'\s*\(guest\)\s*$','','i'),NFC))=regexp_replace(p_name,'\s*\(guest\)\s*$','','i')
 AND (a.profile_id IS NULL OR (a.mapping_verified AND a.status='active' AND NOT a.must_change_password AND r.role='member' AND r.enabled))
 ORDER BY u.id LIMIT 20) t;
$$;

CREATE FUNCTION account_security.prepare_guest_login(p_profile_id uuid,p_name text,p_phone text,p_pin text,
 p_client_key text,p_subject_key text,p_claim_id uuid,p_login_domain text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_profile uuid; v_user public.users%ROWTYPE; v_account account_security.accounts%ROWTYPE; v_identifier account_security.login_identifiers%ROWTYPE;
 v_provision account_security.guest_login_provisions%ROWTYPE; registered boolean; count_identities integer; hits integer;
 v_limit_key text; v_bucket bigint:=floor(extract(epoch FROM clock_timestamp())/600)::bigint;
BEGIN
 IF current_setting('role',true)<>'account_guest_login_worker' OR p_client_key !~ '^[a-f0-9]{64}$'
    OR p_subject_key !~ '^[a-f0-9]{64}$' OR p_claim_id IS NULL OR p_login_domain !~ '^[-a-z0-9.]+\.[a-z]+$' THEN
   RAISE EXCEPTION 'invalid_guest_login' USING ERRCODE='22023';
 END IF;
 -- No quota or account changes when this is an ordinary member login.
 SELECT EXISTS(SELECT 1 FROM account_security.guest_login_profiles g JOIN public.users candidate_user ON candidate_user.id=g.profile_id
  WHERE (p_profile_id IS NOT NULL AND candidate_user.id=p_profile_id OR p_profile_id IS NULL AND
   lower(normalize(regexp_replace(btrim(candidate_user.name),'\s*\(guest\)\s*$','','i'),NFC))=regexp_replace(p_name,'\s*\(guest\)\s*$','','i'))
  AND candidate_user.user_group='게스트') INTO registered;
 IF NOT registered THEN RETURN jsonb_build_object('kind','member'); END IF;
 FOREACH v_limit_key IN ARRAY ARRAY[p_client_key,p_subject_key] LOOP
   INSERT INTO account_security.login_limits(key,bucket,attempts) VALUES(v_limit_key,v_bucket,1)
     ON CONFLICT(key,bucket) DO UPDATE SET attempts=account_security.login_limits.attempts+1 RETURNING attempts INTO hits;
   IF hits>(CASE WHEN v_limit_key=p_client_key THEN 100 ELSE 5 END) THEN RETURN jsonb_build_object('kind','denied','code','try_later'); END IF;
 END LOOP;
 IF p_profile_id IS NULL THEN
   SELECT count(*),min(x.id::text)::uuid INTO count_identities,v_profile FROM (
     SELECT candidate_user.id FROM public.users candidate_user JOIN account_security.guest_login_profiles g ON g.profile_id=candidate_user.id AND candidate_user.created_at=g.profile_created_at
     WHERE g.enabled AND g.revoked_at IS NULL AND candidate_user.user_group='게스트' AND candidate_user.status IS DISTINCT FROM 'withdrawn' AND candidate_user.status IS DISTINCT FROM 'deleted'
     AND lower(normalize(regexp_replace(btrim(candidate_user.name),'\s*\(guest\)\s*$','','i'),NFC))=regexp_replace(p_name,'\s*\(guest\)\s*$','','i')
     AND (p_phone IS NULL OR regexp_replace(COALESCE(candidate_user.phone,''),'[^0-9]','','g')=p_phone)
     UNION SELECT candidate_user.id FROM public.users candidate_user JOIN account_security.accounts candidate_account ON candidate_account.profile_id=candidate_user.id
       JOIN account_security.login_identifiers candidate_identifier ON candidate_identifier.profile_id=candidate_user.id
     WHERE candidate_account.mapping_verified AND candidate_account.status='active' AND candidate_identifier.enabled
       AND lower(normalize(btrim(candidate_user.name),NFC))=p_name
       AND (p_phone IS NULL OR regexp_replace(COALESCE(candidate_user.phone,''),'[^0-9]','','g')=p_phone)
   ) x;
   IF count_identities<>1 THEN RETURN jsonb_build_object('kind','denied','code','selection_required'); END IF;
 ELSE v_profile:=p_profile_id; END IF;
 SELECT * INTO v_user FROM public.users WHERE id=v_profile FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM account_security.guest_login_profiles g WHERE g.profile_id=v_user.id
     AND g.profile_created_at=v_user.created_at AND g.enabled AND g.revoked_at IS NULL)
   OR v_user.user_group IS DISTINCT FROM '게스트' OR v_user.status IN('withdrawn','deleted')
   OR p_pin !~ '^[0-9]{4}$' OR regexp_replace(COALESCE(v_user.phone,''),'[^0-9]','','g') !~ '^01[0-9]{8,9}$'
   OR right(regexp_replace(COALESCE(v_user.phone,''),'[^0-9]','','g'),4)<>p_pin THEN
   RETURN jsonb_build_object('kind','denied','code','invalid_login');
 END IF;
 SELECT * INTO v_account FROM account_security.accounts WHERE profile_id=v_profile;
 IF v_account.profile_id IS NOT NULL THEN
   IF NOT v_account.mapping_verified OR v_account.status<>'active' OR v_account.must_change_password OR NOT EXISTS(
     SELECT 1 FROM account_security.account_roles r WHERE r.profile_id=v_profile AND r.role='member' AND r.enabled) THEN
     RETURN jsonb_build_object('kind','denied','code','invalid_login');
   END IF;
   SELECT * INTO v_identifier FROM account_security.login_identifiers WHERE profile_id=v_profile AND enabled;
   IF v_identifier.profile_id IS NULL THEN RETURN jsonb_build_object('kind','denied','code','invalid_login'); END IF;
 ELSE
   INSERT INTO account_security.guest_login_provisions(profile_id,operation_id,login_email)
     VALUES(v_profile,gen_random_uuid(),'guest-'||v_profile::text||'@'||p_login_domain) ON CONFLICT(profile_id) DO NOTHING;
   SELECT * INTO v_provision FROM account_security.guest_login_provisions WHERE profile_id=v_profile;
 END IF;
 INSERT INTO account_security.guest_login_claims(id,profile_id,phone_fingerprint)
   VALUES(p_claim_id,v_profile,md5(regexp_replace(v_user.phone,'[^0-9]','','g')));
 RETURN jsonb_build_object('kind','guest','profileId',v_profile,'claimId',p_claim_id,
   'authUserId',COALESCE(v_account.auth_user_id,v_provision.auth_user_id),'loginEmail',COALESCE(v_identifier.login_email,v_provision.login_email),
   'credentialMode',v_identifier.credential_mode,'name',v_user.name,'phone',regexp_replace(v_user.phone,'[^0-9]','','g'),
   'legacyDigest',(SELECT password_digest FROM account_security.legacy_credentials WHERE profile_id=v_user.id),
   'operationId',COALESCE(v_provision.operation_id,(SELECT operation_id FROM account_security.guest_login_provisions WHERE profile_id=v_user.id)),
   'state',v_provision.state);
END;
$$;

CREATE FUNCTION account_security.claim_guest_auth_creation(p_profile_id uuid,p_operation_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF current_setting('role',true)<>'account_guest_login_worker' THEN RAISE EXCEPTION 'guest_worker_required' USING ERRCODE='42501'; END IF;
 UPDATE account_security.guest_login_provisions SET state='creating',claim_started_at=clock_timestamp()
   WHERE profile_id=p_profile_id AND operation_id=p_operation_id AND
     (state='reserved' OR (state='creating' AND auth_user_id IS NULL AND claim_started_at<clock_timestamp()-interval '30 seconds'));
 RETURN FOUND;
END; $$;
CREATE FUNCTION account_security.complete_guest_auth_creation(p_profile_id uuid,p_operation_id uuid,p_auth_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF current_setting('role',true)<>'account_guest_login_worker' OR NOT EXISTS(
  SELECT 1 FROM account_security.guest_login_provisions p JOIN auth.users a ON a.id=p_auth_id AND a.email=p.login_email
   WHERE p.profile_id=p_profile_id AND p.operation_id=p_operation_id AND p.state IN('creating','ready')
   AND a.raw_app_meta_data->>'guest_login_operation'=p_operation_id::text
   AND a.raw_app_meta_data->>'guest_login_profile'=p_profile_id::text AND NOT a.is_anonymous
   AND (p.auth_user_id IS NULL OR p.auth_user_id=p_auth_id)) THEN RAISE EXCEPTION 'invalid_guest_auth_binding' USING ERRCODE='42501'; END IF;
 UPDATE account_security.guest_login_provisions SET state='ready',auth_user_id=p_auth_id,ready_at=COALESCE(ready_at,clock_timestamp())
 WHERE profile_id=p_profile_id AND operation_id=p_operation_id;
END; $$;

CREATE FUNCTION account_security.finalize_guest_login(p_claim_id uuid,p_auth_id uuid,p_session_id uuid,
 p_name_key text,p_phone_key text,p_valid_until timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE claim account_security.guest_login_claims%ROWTYPE; u public.users%ROWTYPE;
 a account_security.accounts%ROWTYPE; i account_security.login_identifiers%ROWTYPE; email text;
BEGIN
 IF current_setting('role',true)<>'account_guest_login_worker' OR p_name_key !~ '^[a-f0-9]{64}$' OR p_phone_key !~ '^[a-f0-9]{64}$'
 OR p_session_id IS NULL OR p_valid_until<=clock_timestamp() OR p_valid_until>clock_timestamp()+interval '25 hours'
 OR NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=p_session_id AND s.user_id=p_auth_id AND (s.not_after IS NULL OR s.not_after>clock_timestamp())) THEN
   RAISE EXCEPTION 'invalid_guest_session' USING ERRCODE='42501'; END IF;
 SELECT * INTO claim FROM account_security.guest_login_claims WHERE id=p_claim_id FOR UPDATE;
 IF claim.id IS NULL OR claim.consumed_at IS NOT NULL OR claim.expires_at<=clock_timestamp() THEN
   RAISE EXCEPTION 'guest_claim_expired' USING ERRCODE='42501'; END IF;
 SELECT * INTO u FROM public.users WHERE id=claim.profile_id FOR UPDATE;
 IF u.user_group IS DISTINCT FROM '게스트' OR u.status IN('withdrawn','deleted')
   OR md5(regexp_replace(COALESCE(u.phone,''),'[^0-9]','','g'))<>claim.phone_fingerprint
   OR NOT EXISTS(SELECT 1 FROM account_security.guest_login_profiles g WHERE g.profile_id=u.id AND g.profile_created_at=u.created_at AND g.enabled AND g.revoked_at IS NULL) THEN
   RAISE EXCEPTION 'guest_identity_changed' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM account_security.accounts WHERE profile_id=u.id FOR UPDATE;
 IF a.profile_id IS NULL THEN
   SELECT p.login_email INTO email FROM account_security.guest_login_provisions p JOIN auth.users au ON au.id=p.auth_user_id
     WHERE p.profile_id=u.id AND p.state='ready' AND p.auth_user_id=p_auth_id AND au.email=p.login_email
       AND au.raw_app_meta_data->>'guest_login_profile'=u.id::text AND NOT au.is_anonymous;
   IF email IS NULL OR EXISTS(SELECT 1 FROM account_security.accounts WHERE auth_user_id=p_auth_id) THEN
     RAISE EXCEPTION 'guest_mapping_conflict' USING ERRCODE='42501'; END IF;
   INSERT INTO account_security.accounts(profile_id,auth_user_id,mapping_verified,status,credential_version,must_change_password)
     VALUES(u.id,p_auth_id,true,'active',1,false) RETURNING * INTO a;
   INSERT INTO account_security.account_roles(profile_id,role,enabled) VALUES(u.id,'member',true);
   INSERT INTO account_security.login_identifiers(profile_id,login_email,name_key,phone_key,credential_mode,enabled)
     VALUES(u.id,email,p_name_key,p_phone_key,'guest_phone_pin',true);
   UPDATE public.users SET auth_user_id=p_auth_id WHERE id=u.id;
 ELSE
   SELECT * INTO i FROM account_security.login_identifiers WHERE profile_id=u.id;
   IF a.auth_user_id<>p_auth_id OR NOT a.mapping_verified OR a.status<>'active' OR a.must_change_password OR NOT i.enabled
      OR NOT EXISTS(SELECT 1 FROM account_security.account_roles r WHERE r.profile_id=u.id AND r.role='member' AND r.enabled)
      OR NOT EXISTS(SELECT 1 FROM auth.users au WHERE au.id=p_auth_id AND au.email=i.login_email AND NOT au.is_anonymous) THEN
     RAISE EXCEPTION 'guest_identity_changed' USING ERRCODE='42501'; END IF;
 END IF;
 INSERT INTO account_security.session_assurances(session_id,auth_user_id,profile_id,credential_version,status,valid_until)
   VALUES(p_session_id,p_auth_id,u.id,a.credential_version,'trusted',p_valid_until);
 UPDATE account_security.guest_login_claims SET consumed_at=clock_timestamp() WHERE id=p_claim_id;
 RETURN jsonb_build_object('profileId',u.id,'authUserId',p_auth_id);
END;
$$;

REVOKE ALL ON FUNCTION account_security.guest_login_candidates(text),
 account_security.prepare_guest_login(uuid,text,text,text,text,text,uuid,text),
 account_security.claim_guest_auth_creation(uuid,uuid),account_security.complete_guest_auth_creation(uuid,uuid,uuid),
 account_security.finalize_guest_login(uuid,uuid,uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION account_security.guest_login_candidates(text) TO account_login_worker,account_guest_login_worker;
GRANT EXECUTE ON FUNCTION account_security.prepare_guest_login(uuid,text,text,text,text,text,uuid,text),
 account_security.claim_guest_auth_creation(uuid,uuid),account_security.complete_guest_auth_creation(uuid,uuid,uuid),
 account_security.finalize_guest_login(uuid,uuid,uuid,text,text,timestamptz) TO account_guest_login_worker;

CREATE FUNCTION account_security.can_upgrade_guest(p_profile_id uuid,p_auth_id uuid,p_session_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM account_security.guest_login_profiles g JOIN public.users u ON u.id=g.profile_id AND u.created_at=g.profile_created_at
  JOIN account_security.accounts a ON a.profile_id=u.id JOIN account_security.account_roles r ON r.profile_id=u.id
  JOIN account_security.session_assurances s ON s.profile_id=u.id AND s.auth_user_id=a.auth_user_id AND s.credential_version=a.credential_version
  WHERE u.id=p_profile_id AND u.user_group='게스트' AND u.status IS DISTINCT FROM 'withdrawn' AND u.status IS DISTINCT FROM 'deleted'
   AND g.enabled AND g.revoked_at IS NULL AND a.mapping_verified AND a.status='active' AND NOT a.must_change_password
   AND r.role='member' AND r.enabled AND a.auth_user_id=p_auth_id AND s.session_id=p_session_id AND s.status='trusted' AND s.valid_until>clock_timestamp()
   AND EXISTS(SELECT 1 FROM auth.sessions ls WHERE ls.id=p_session_id AND ls.user_id=p_auth_id AND (ls.not_after IS NULL OR ls.not_after>clock_timestamp())));
$$;
CREATE FUNCTION account_security.guest_has_account(p_profile_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM account_security.accounts WHERE profile_id=p_profile_id);
$$;
CREATE FUNCTION account_security.complete_guest_membership(p_operation_id uuid,p_profile_id uuid,p_old_auth_id uuid,p_old_session_id uuid,
 p_new_auth_id uuid,p_new_session_id uuid,p_profile jsonb,p_name_key text,p_phone_key text,p_details_key text,p_terms_version text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE email text;
BEGIN
 IF current_setting('role',true)<>'account_membership_worker' OR p_profile->>'user_group' NOT IN('청소년','졸업생')
  OR p_name_key !~ '^[a-f0-9]{64}$' OR p_phone_key !~ '^[a-f0-9]{64}$' OR p_details_key !~ '^[a-f0-9]{64}$'
  OR NOT account_security.can_upgrade_guest(p_profile_id,p_old_auth_id,p_old_session_id) THEN
   RAISE EXCEPTION 'guest_upgrade_proof_required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.users WHERE id=p_profile_id FOR UPDATE;
 PERFORM 1 FROM account_security.accounts WHERE profile_id=p_profile_id FOR UPDATE;
 IF NOT account_security.can_upgrade_guest(p_profile_id,p_old_auth_id,p_old_session_id) THEN
   RAISE EXCEPTION 'guest_upgrade_changed' USING ERRCODE='42501'; END IF;
 SELECT o.login_email INTO email FROM account_security.registration_operations o JOIN auth.users au ON au.id=p_new_auth_id
   WHERE o.id=p_operation_id AND o.auth_user_id=p_new_auth_id AND o.state='auth_ready' AND o.valid_until>clock_timestamp()
    AND o.details_key=p_details_key AND au.email=o.login_email AND NOT au.is_anonymous
    AND au.raw_app_meta_data->>'registration_operation'=o.id::text;
 IF email IS NULL OR p_new_auth_id=p_old_auth_id OR EXISTS(SELECT 1 FROM account_security.accounts WHERE auth_user_id=p_new_auth_id)
 OR NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=p_new_session_id AND s.user_id=p_new_auth_id AND (s.not_after IS NULL OR s.not_after>clock_timestamp())) THEN
   RAISE EXCEPTION 'guest_upgrade_binding_invalid' USING ERRCODE='42501'; END IF;
 UPDATE public.users SET auth_user_id=p_new_auth_id,name=p_profile->>'name',gender=p_profile->>'gender',school=p_profile->>'school',
  church=p_profile->>'church',birth=p_profile->>'birth',phone=p_profile->>'phone',phone_back4=p_profile->>'phone_back4',
  user_group=p_profile->>'user_group',role='user',status=p_profile->>'status',guardian_name=p_profile->>'guardian_name',
  guardian_phone=p_profile->>'guardian_phone',guardian_relation=p_profile->>'guardian_relation',password=NULL,
  preferences=COALESCE(preferences,'{}'::jsonb)||COALESCE(p_profile->'preferences','{}'::jsonb)||jsonb_build_object(
    'is_temporary',false,'terms_agreed_at',clock_timestamp(),'terms_consent_source','SIGNUP') WHERE id=p_profile_id;
 UPDATE account_security.accounts SET auth_user_id=p_new_auth_id,credential_version=credential_version+1,
   mapping_verified=true,status='active',must_change_password=false WHERE profile_id=p_profile_id;
 UPDATE account_security.login_identifiers SET login_email=email,name_key=p_name_key,phone_key=p_phone_key,
   credential_mode='supabase_password',enabled=true WHERE profile_id=p_profile_id;
 INSERT INTO account_security.member_terms_consents(profile_id,auth_user_id,session_id,terms_version,source,art1,art2,art3,art4,accepted_at)
   VALUES(p_profile_id,p_new_auth_id,p_new_session_id,p_terms_version,'SIGNUP',true,true,true,true,clock_timestamp())
   ON CONFLICT(profile_id,terms_version) DO NOTHING;
 INSERT INTO account_security.membership_receipts(operation_id,profile_id,auth_user_id,phone_key,details_key,result)
   VALUES(p_operation_id,p_profile_id,p_new_auth_id,p_phone_key,p_details_key,'registered');
END;
$$;
REVOKE ALL ON FUNCTION account_security.can_upgrade_guest(uuid,uuid,uuid),account_security.guest_has_account(uuid),
 account_security.complete_guest_membership(uuid,uuid,uuid,uuid,uuid,uuid,jsonb,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION account_security.can_upgrade_guest(uuid,uuid,uuid),account_security.guest_has_account(uuid)
 TO account_registration_worker,account_membership_worker;
GRANT EXECUTE ON FUNCTION account_security.complete_guest_membership(uuid,uuid,uuid,uuid,uuid,uuid,jsonb,text,text,text,text)
 TO account_membership_worker;

-- Retire the separate community guest session without deleting its history.
REVOKE EXECUTE ON FUNCTION community_security.verify_guest(uuid,text,text,text,text,text),
 community_security.guest_action(text,uuid,text,jsonb) FROM community_guest_worker;
CREATE OR REPLACE FUNCTION public.can_access_community_channel(p_channel_id uuid,p_profile_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT public.is_current_staff() OR EXISTS(
   SELECT 1 FROM public.community_channels c LEFT JOIN public.notices n ON n.id=c.source_notice_id
   WHERE c.id=p_channel_id AND community_security.effective_status(c.id)='ACTIVE'
     AND (c.source_notice_id IS NULL OR (n.category='PROGRAM' AND n.community_enabled))
     AND account_security.current_profile_id() IS NOT NULL
     AND (community_security.is_open_program(c.id) OR EXISTS(
       SELECT 1 FROM community_security.member_ids(c.id) m WHERE m.user_id=account_security.current_profile_id())));
$$;
DO $$ DECLARE signature text; definition text; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.create_community_post_with_media(jsonb,boolean)','public.update_community_post_with_media(jsonb)',
  'public.update_online_challenge_post(uuid,uuid,text,uuid)','public.replace_community_post_media(uuid,uuid,text[],text[])',
  'public.mark_community_channel_read(uuid,uuid,timestamptz)'] LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
  EXECUTE replace(definition,'community_security.is_current_profile(','public.is_current_profile(');
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
