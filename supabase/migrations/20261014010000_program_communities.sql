-- Shared program communities. Existing posts, submissions, rewards and logs are preserved.
BEGIN;
CREATE SCHEMA IF NOT EXISTS community_security;
REVOKE ALL ON SCHEMA community_security FROM PUBLIC, anon, authenticated;
ALTER TABLE public.community_channel_members ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE OR REPLACE FUNCTION community_security.effective_status(p_channel_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN c.source_notice_id IS NOT NULL AND c.status='SCHEDULED'
   AND (n.recruitment_start_at IS NULL OR n.recruitment_start_at<=now()) THEN 'ACTIVE' ELSE c.status END
 FROM public.community_channels c LEFT JOIN public.notices n ON n.id=c.source_notice_id WHERE c.id=p_channel_id;
$$;

CREATE OR REPLACE FUNCTION community_security.is_open_program(p_channel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.community_channels c JOIN public.notices n ON n.id=c.source_notice_id
   WHERE c.id=p_channel_id AND n.category='PROGRAM' AND NOT n.is_challenge
   AND n.is_recruiting IS FALSE AND n.community_enabled);
$$;

-- One participant rule for membership, roster, counts, mentions and push.
-- Open-program visitors do not become members; only explicitly added members appear here.
CREATE OR REPLACE FUNCTION community_security.member_ids(p_channel_id uuid)
RETURNS TABLE(user_id uuid,source text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 WITH candidates AS (
   SELECT m.user_id,'DIRECT'::text AS source FROM public.community_channel_members m
     WHERE m.channel_id=p_channel_id AND m.revoked_at IS NULL
   UNION ALL
   SELECT r.user_id,'PROGRAM'::text FROM public.community_channels c JOIN public.notices n ON n.id=c.source_notice_id
     JOIN public.notice_responses r ON r.notice_id=n.id AND r.status='JOIN'
     WHERE c.id=p_channel_id AND n.community_enabled AND (n.is_challenge OR (n.is_recruiting IS TRUE
       AND NOT (COALESCE(n.guest_properties->>'schedule_mode','')='RECURRING'
         AND COALESCE(n.guest_properties->>'application_scope','')='SESSION')))
   UNION ALL
   SELECT r.user_id,'PROGRAM'::text FROM public.community_channels c JOIN public.notices n ON n.id=c.source_notice_id
     JOIN public.daily_program_sessions s ON s.notice_id=n.id AND s.voided_at IS NULL
     JOIN public.daily_program_session_responses r ON r.session_id=s.id AND (r.status='JOIN' OR r.is_attended)
     WHERE c.id=p_channel_id AND n.community_enabled AND NOT n.is_challenge AND n.is_recruiting IS TRUE
       AND n.guest_properties->>'schedule_mode'='RECURRING' AND n.guest_properties->>'application_scope'='SESSION'
 ) SELECT DISTINCT ON (a.user_id) a.user_id,a.source FROM candidates a JOIN public.users u ON u.id=a.user_id
   WHERE u.status IS DISTINCT FROM 'withdrawn' AND u.status IS DISTINCT FROM 'deleted'
   ORDER BY a.user_id,a.source;
$$;

CREATE OR REPLACE FUNCTION public.can_access_community_channel(p_channel_id uuid,p_profile_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT public.is_current_staff() OR EXISTS(
   SELECT 1 FROM public.community_channels c LEFT JOIN public.notices n ON n.id=c.source_notice_id
   WHERE c.id=p_channel_id AND community_security.effective_status(c.id)='ACTIVE'
     AND (c.source_notice_id IS NULL OR (n.category='PROGRAM' AND n.community_enabled))
     AND account_security.current_profile_id() IS NOT NULL
     AND (community_security.is_open_program(c.id) OR EXISTS(
       SELECT 1 FROM community_security.member_ids(c.id) m WHERE m.user_id=account_security.current_profile_id()))
 );
$$;

CREATE FUNCTION community_security.guard_channel_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.source_notice_id IS NOT NULL AND NEW.status IN('ACTIVE','SCHEDULED')
   AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.source_notice_id IS DISTINCT FROM OLD.source_notice_id) THEN
   IF EXISTS(SELECT 1 FROM public.notices WHERE id=NEW.source_notice_id AND recruitment_start_at>now()) THEN
     NEW.status:='SCHEDULED';
   ELSE NEW.status:='ACTIVE'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER guard_program_community_status BEFORE INSERT OR UPDATE OF source_notice_id,status ON public.community_channels
 FOR EACH ROW EXECUTE FUNCTION community_security.guard_channel_status();

CREATE FUNCTION public.community_channel_directory_rows() RETURNS TABLE(id uuid,name text,description text,channel_type text,source_notice_id bigint,created_at timestamptz,updated_at timestamptz,status text,is_open_program boolean,participant_count bigint,source_notice jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
SELECT c.id,c.name,c.description,c.channel_type,c.source_notice_id,c.created_at,c.updated_at,
   community_security.effective_status(c.id) AS status,
   community_security.is_open_program(c.id) AS is_open_program,
   (SELECT count(*) FROM community_security.member_ids(c.id)) AS participant_count,
   CASE WHEN n.id IS NOT NULL THEN jsonb_build_object('id',n.id,'title',n.title,'category',n.category,
     'is_challenge',n.is_challenge,'challenge_format',n.challenge_format,'is_recruiting',n.is_recruiting,
     'recruitment_start_at',n.recruitment_start_at) END AS source_notice
 FROM public.community_channels c LEFT JOIN public.notices n ON n.id=c.source_notice_id
 WHERE auth.role()='service_role' OR public.is_current_staff() OR public.can_access_community_channel(c.id);
$$;
REVOKE ALL ON FUNCTION public.community_channel_directory_rows() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.community_channel_directory_rows() TO authenticated,service_role;
CREATE VIEW public.community_channel_directory WITH (security_barrier=true) AS SELECT * FROM public.community_channel_directory_rows();
REVOKE ALL ON public.community_channel_directory FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.community_channel_directory TO authenticated,service_role;

CREATE FUNCTION public.community_channel_participants_rows() RETURNS TABLE(channel_id uuid,user_id uuid,source text,member_role text,"user" jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
SELECT c.id AS channel_id,m.user_id,m.source,COALESCE(d.member_role,'PARTICIPANT') AS member_role,
   jsonb_build_object('id',u.id,'name',u.name,'school',u.school,'profile_image_url',u.profile_image_url) AS "user"
 FROM public.community_channels c CROSS JOIN LATERAL community_security.member_ids(c.id) m
 JOIN public.users u ON u.id=m.user_id
 LEFT JOIN public.community_channel_members d ON d.channel_id=c.id AND d.user_id=m.user_id AND d.revoked_at IS NULL
 WHERE auth.role()='service_role' OR public.is_current_staff() OR public.can_access_community_channel(c.id);
$$;
REVOKE ALL ON FUNCTION public.community_channel_participants_rows() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.community_channel_participants_rows() TO authenticated,service_role;
CREATE VIEW public.community_channel_participants WITH (security_barrier=true) AS SELECT * FROM public.community_channel_participants_rows();
REVOKE ALL ON public.community_channel_participants FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.community_channel_participants TO authenticated,service_role;

CREATE FUNCTION public.community_channel_invites_rows() RETURNS TABLE(id uuid,name text,description text,source_notice_id bigint,source_title text,status text,is_open_program boolean,participant_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
SELECT c.id,c.name,c.description,c.source_notice_id,n.title AS source_title,
   community_security.effective_status(c.id) AS status,
   community_security.is_open_program(c.id) AS is_open_program,
   (SELECT count(*) FROM community_security.member_ids(c.id)) AS participant_count
 FROM public.community_channels c LEFT JOIN public.notices n ON n.id=c.source_notice_id
 WHERE community_security.effective_status(c.id) IN ('SCHEDULED','ACTIVE')
   AND (c.source_notice_id IS NULL OR (n.category='PROGRAM' AND n.community_enabled));
$$;
REVOKE ALL ON FUNCTION public.community_channel_invites_rows() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.community_channel_invites_rows() TO anon,authenticated,service_role;
CREATE VIEW public.community_channel_invites WITH (security_barrier=true) AS SELECT * FROM public.community_channel_invites_rows();
REVOKE ALL ON public.community_channel_invites FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.community_channel_invites TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.is_joinable_standalone_channel(p_channel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.community_channels c WHERE c.id=p_channel_id
   AND c.source_notice_id IS NULL AND c.channel_type='PRIVATE' AND c.status='ACTIVE');
$$;
CREATE POLICY community_members_self_rejoin ON public.community_channel_members FOR UPDATE TO authenticated
 USING(public.is_current_profile(user_id) AND public.is_joinable_standalone_channel(channel_id))
 WITH CHECK(public.is_current_profile(user_id) AND member_role='MEMBER' AND revoked_at IS NULL
   AND public.is_joinable_standalone_channel(channel_id));
CREATE POLICY community_members_self_leave ON public.community_channel_members FOR UPDATE TO authenticated
 USING(public.is_current_profile(user_id) AND public.can_access_community_channel(channel_id))
 WITH CHECK(public.is_current_profile(user_id) AND revoked_at IS NOT NULL);

-- Ordinary information edits never reopen a manually closed community.
CREATE OR REPLACE FUNCTION public.sync_notice_community_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE requested uuid:=NULLIF(NEW.guest_properties->>'community_channel_id','')::uuid;
 existing public.community_channels%ROWTYPE; selected public.community_channels%ROWTYPE; initial_status text;
BEGIN
 SELECT * INTO existing FROM public.community_channels WHERE source_notice_id=NEW.id FOR UPDATE;
 IF NEW.category='PROGRAM' AND NEW.community_enabled THEN
   initial_status:=CASE WHEN NEW.recruitment_start_at>now() THEN 'SCHEDULED' ELSE 'ACTIVE' END;
   IF TG_OP='UPDATE' AND NEW.guest_properties ? 'community_expected_channel_id'
     AND requested IS DISTINCT FROM existing.id
     AND NULLIF(NEW.guest_properties->>'community_expected_channel_id','')::uuid IS DISTINCT FROM existing.id THEN
     RAISE EXCEPTION '커뮤니티 연결이 다른 곳에서 변경되었습니다. 새로고침 후 다시 선택해주세요.' USING ERRCODE='40001';
   END IF;
   IF requested IS NOT NULL THEN
     SELECT * INTO selected FROM public.community_channels WHERE id=requested FOR UPDATE;
     IF NOT FOUND OR selected.status='ARCHIVED' THEN
       RAISE EXCEPTION '선택한 커뮤니티를 찾을 수 없습니다.' USING ERRCODE='23503';
     END IF;
     IF selected.source_notice_id IS NOT NULL AND selected.source_notice_id<>NEW.id THEN
       RAISE EXCEPTION '다른 프로그램에 연결된 커뮤니티입니다. 새로고침 후 다시 선택해주세요.' USING ERRCODE='40001';
     END IF;
     IF existing.id IS NOT NULL AND existing.id<>requested THEN
       UPDATE public.community_channel_members SET revoked_at=now() WHERE channel_id=existing.id AND revoked_at IS NULL;
       UPDATE public.community_channels SET source_notice_id=NULL,channel_type='PRIVATE',status='CLOSED',updated_at=now() WHERE id=existing.id;
     END IF;
     UPDATE public.community_channels SET source_notice_id=NEW.id,
       channel_type=CASE WHEN NEW.is_challenge THEN 'CHALLENGE' ELSE 'PROGRAM' END,
       status=CASE WHEN selected.source_notice_id IS DISTINCT FROM NEW.id THEN initial_status
         WHEN selected.status='SCHEDULED' AND TG_OP='UPDATE' AND OLD.recruitment_start_at<=now() THEN 'ACTIVE'
         WHEN selected.status='SCHEDULED' THEN initial_status ELSE selected.status END,updated_at=now() WHERE id=requested;
   ELSIF existing.id IS NULL THEN
     INSERT INTO public.community_channels(name,channel_type,source_notice_id,status)
       VALUES(NEW.title,CASE WHEN NEW.is_challenge THEN 'CHALLENGE' ELSE 'PROGRAM' END,NEW.id,initial_status);
   ELSE
     UPDATE public.community_channels SET
       name=CASE WHEN COALESCE(OLD.guest_properties->>'community_channel_id','')='' THEN NEW.title ELSE name END,
       channel_type=CASE WHEN NEW.is_challenge THEN 'CHALLENGE' ELSE 'PROGRAM' END,
       status=CASE WHEN status='SCHEDULED' AND TG_OP='UPDATE' AND OLD.recruitment_start_at<=now() THEN 'ACTIVE'
         WHEN status='SCHEDULED' THEN initial_status ELSE status END,updated_at=now() WHERE id=existing.id;
   END IF;
 ELSE
   UPDATE public.community_channels SET status='CLOSED',updated_at=now() WHERE source_notice_id=NEW.id;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_notice_community_channel ON public.notices;
CREATE TRIGGER trg_sync_notice_community_channel AFTER INSERT OR UPDATE OF community_enabled,title,category,is_challenge,challenge_format,recruitment_start_at,guest_properties
 ON public.notices FOR EACH ROW EXECUTE FUNCTION public.sync_notice_community_channel();

CREATE OR REPLACE FUNCTION public.detach_notice_community_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE public.community_channel_members SET revoked_at=now() WHERE revoked_at IS NULL
   AND channel_id IN(SELECT id FROM public.community_channels WHERE source_notice_id=OLD.id);
 UPDATE public.community_channels SET source_notice_id=NULL,channel_type='PRIVATE',status='CLOSED',updated_at=now() WHERE source_notice_id=OLD.id;
 RETURN OLD;
END;
$$;

CREATE FUNCTION public.set_community_channel_program(p_channel_id uuid,p_notice_id bigint,p_expected_notice_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.community_channels%ROWTYPE; n public.notices%ROWTYPE;
BEGIN
 IF NOT public.is_current_staff() THEN RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE='42501'; END IF;
 -- Lock programs before channels, in a consistent order with program saves.
 PERFORM id FROM public.notices WHERE id IN(p_notice_id,p_expected_notice_id) ORDER BY id FOR UPDATE;
 SELECT * INTO c FROM public.community_channels WHERE id=p_channel_id FOR UPDATE;
 IF NOT FOUND OR c.status='ARCHIVED' THEN RAISE EXCEPTION '커뮤니티를 찾을 수 없습니다.' USING ERRCODE='23503'; END IF;
 IF c.source_notice_id IS DISTINCT FROM p_expected_notice_id THEN
   RAISE EXCEPTION '연결이 다른 곳에서 변경되었습니다. 새로고침 후 다시 시도해주세요.' USING ERRCODE='40001';
 END IF;
 IF p_notice_id IS NOT NULL THEN
   SELECT * INTO n FROM public.notices WHERE id=p_notice_id AND category='PROGRAM';
   IF NOT FOUND THEN RAISE EXCEPTION '프로그램만 연결할 수 있습니다.' USING ERRCODE='23514'; END IF;
   IF EXISTS(SELECT 1 FROM public.community_channels WHERE source_notice_id=p_notice_id AND id<>c.id) THEN
     RAISE EXCEPTION '이미 다른 커뮤니티가 연결된 프로그램입니다.' USING ERRCODE='40001';
   END IF;
 END IF;
 IF c.source_notice_id IS NOT NULL AND c.source_notice_id IS DISTINCT FROM p_notice_id THEN
   UPDATE public.notices SET community_enabled=false,
     guest_properties=COALESCE(guest_properties,'{}'::jsonb)-'community_channel_id'-'community_expected_channel_id'
     WHERE id=c.source_notice_id;
 END IF;
 IF p_notice_id IS NULL THEN
   UPDATE public.community_channel_members SET revoked_at=now() WHERE channel_id=c.id AND revoked_at IS NULL;
   UPDATE public.community_channels SET source_notice_id=NULL,channel_type='PRIVATE',status='CLOSED',updated_at=now() WHERE id=c.id;
 ELSE
   UPDATE public.community_channels SET source_notice_id=p_notice_id,
     channel_type=CASE WHEN n.is_challenge THEN 'CHALLENGE' ELSE 'PROGRAM' END,
     status=CASE WHEN c.source_notice_id IS NOT DISTINCT FROM p_notice_id THEN c.status
       WHEN n.recruitment_start_at>now() THEN 'SCHEDULED' ELSE 'ACTIVE' END,updated_at=now() WHERE id=c.id;
   UPDATE public.notices SET community_enabled=true,
     guest_properties=jsonb_set(COALESCE(guest_properties,'{}'::jsonb)-'community_expected_channel_id','{community_channel_id}',to_jsonb(c.id::text),true)
     WHERE id=p_notice_id;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_community_channel_program(uuid,bigint,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_community_channel_program(uuid,bigint,bigint) TO authenticated;
CREATE OR REPLACE FUNCTION public.link_community_channel_to_notice(p_channel_id uuid,p_notice_id bigint DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM public.set_community_channel_program(p_channel_id,p_notice_id,
   (SELECT source_notice_id FROM public.community_channels WHERE id=p_channel_id));
END;
$$;

CREATE FUNCTION public.community_channel_is_active(p_channel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT community_security.effective_status(p_channel_id)='ACTIVE';
$$;
REVOKE ALL ON FUNCTION public.community_channel_is_active(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.community_channel_is_active(uuid) TO authenticated,service_role;

CREATE FUNCTION public.create_community_post_with_media(p_payload jsonb,p_is_announcement boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE post_id uuid; c public.community_channels%ROWTYPE; urls jsonb:=COALESCE(p_payload->'image_urls','[]');
 author uuid:=(p_payload->>'author_id')::uuid; mission uuid:=NULLIF(p_payload->>'mission_id','')::uuid; item jsonb; ordinal integer:=0;
BEGIN
 SELECT * INTO c FROM public.community_channels WHERE id=(p_payload->>'channel_id')::uuid;
 IF NOT FOUND OR NOT public.community_channel_is_active(c.id) OR NOT public.can_access_community_channel(c.id)
   OR NOT public.is_current_profile(author) THEN RAISE EXCEPTION '운영 중인 커뮤니티 참여자만 글을 남길 수 있습니다.' USING ERRCODE='42501'; END IF;
 IF length(trim(COALESCE(p_payload->>'content','')))=0 THEN RAISE EXCEPTION '글 내용을 입력해주세요.' USING ERRCODE='23514'; END IF;
 IF jsonb_typeof(urls)<>'array' OR jsonb_array_length(urls)>10 THEN RAISE EXCEPTION '사진은 최대 10장까지 첨부할 수 있습니다.' USING ERRCODE='23514'; END IF;
 IF mission IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.notices WHERE id=c.source_notice_id AND is_challenge AND challenge_format='ONLINE') THEN
   RAISE EXCEPTION '미션 인증은 온라인 챌린지에서만 가능합니다.' USING ERRCODE='23514'; END IF;
 INSERT INTO public.community_channel_posts(channel_id,author_id,content,is_announcement)
   VALUES(c.id,author,trim(p_payload->>'content'),p_is_announcement) RETURNING id INTO post_id;
 FOR item IN SELECT value FROM jsonb_array_elements(urls) LOOP
   IF jsonb_typeof(item)<>'string' OR length(trim(item#>>'{}'))=0 THEN RAISE EXCEPTION '사진 주소를 확인해주세요.' USING ERRCODE='23514'; END IF;
   INSERT INTO public.community_post_media(post_id,media_url,sort_order) VALUES(post_id,item#>>'{}',ordinal);
   ordinal:=ordinal+1;
 END LOOP;
 IF mission IS NOT NULL THEN
   INSERT INTO public.online_challenge_submissions(challenge_id,mission_id,participant_id,post_id,completion_date,completion_key)
     VALUES(c.source_notice_id,mission,author,post_id,(now() AT TIME ZONE 'Asia/Seoul')::date,post_id::text);
 END IF;
 RETURN post_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_community_post_with_media(jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_community_post_with_media(jsonb,boolean) TO authenticated;

CREATE FUNCTION public.update_community_post_with_media(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE p public.community_channel_posts%ROWTYPE; old_mission uuid; next_mission uuid:=NULLIF(p_payload->>'mission_id','')::uuid;
BEGIN
 SELECT * INTO p FROM public.community_channel_posts WHERE id=(p_payload->>'post_id')::uuid AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT public.is_current_profile(p.author_id) OR NOT public.can_access_community_channel(p.channel_id)
   OR NOT public.community_channel_is_active(p.channel_id) THEN RAISE EXCEPTION '본인 글만 수정할 수 있습니다.' USING ERRCODE='42501'; END IF;
 IF length(trim(COALESCE(p_payload->>'content','')))=0 THEN RAISE EXCEPTION '글 내용을 입력해주세요.' USING ERRCODE='23514'; END IF;
 SELECT mission_id INTO old_mission FROM public.online_challenge_submissions WHERE post_id=p.id AND is_valid;
 IF old_mission IS DISTINCT FROM next_mission THEN
   PERFORM public.update_online_challenge_post(p.id,p.author_id,trim(p_payload->>'content'),next_mission);
 ELSE
   UPDATE public.community_channel_posts SET content=trim(p_payload->>'content'),updated_at=now() WHERE id=p.id;
 END IF;
 IF p_payload ? 'next_urls' THEN
   PERFORM public.replace_community_post_media(p.id,p.author_id,
     ARRAY(SELECT jsonb_array_elements_text(p_payload->'expected_urls')),
     ARRAY(SELECT jsonb_array_elements_text(p_payload->'next_urls')));
 END IF;
 RETURN jsonb_build_object('id',p.id,'content',trim(p_payload->>'content'),'updated_at',now());
END;
$$;
REVOKE ALL ON FUNCTION public.update_community_post_with_media(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.update_community_post_with_media(jsonb) TO authenticated;

DROP POLICY IF EXISTS channel_posts_insert ON public.community_channel_posts;
CREATE POLICY channel_posts_insert ON public.community_channel_posts FOR INSERT TO authenticated WITH CHECK(
 public.is_current_profile(author_id) AND public.can_access_community_channel(channel_id) AND public.community_channel_is_active(channel_id));
DROP POLICY IF EXISTS channel_comments_insert ON public.community_channel_comments;
CREATE POLICY channel_comments_insert ON public.community_channel_comments FOR INSERT TO authenticated WITH CHECK(
 public.is_current_profile(user_id) AND EXISTS(SELECT 1 FROM public.community_channel_posts p WHERE p.id=post_id
   AND p.deleted_at IS NULL AND public.can_access_community_channel(p.channel_id) AND public.community_channel_is_active(p.channel_id)));

-- Permanent table interface: fallback executes the SAME transaction, never a sequence of partial writes.
CREATE TABLE public.community_channel_link_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),requested_by uuid NOT NULL DEFAULT public.current_profile_id(),
 channel_id uuid NOT NULL,notice_id bigint,expected_notice_id bigint,archive boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.community_channel_link_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY link_requests_insert ON public.community_channel_link_requests FOR INSERT TO authenticated WITH CHECK(public.is_current_staff() AND public.is_current_profile(requested_by));
CREATE POLICY link_requests_read ON public.community_channel_link_requests FOR SELECT TO authenticated USING(public.is_current_staff() AND public.is_current_profile(requested_by));
CREATE FUNCTION community_security.apply_link_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM public.set_community_channel_program(NEW.channel_id,NEW.notice_id,NEW.expected_notice_id);
 IF NEW.archive THEN UPDATE public.community_channels SET status='ARCHIVED' WHERE id=NEW.channel_id; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER apply_link_request BEFORE INSERT ON public.community_channel_link_requests FOR EACH ROW EXECUTE FUNCTION community_security.apply_link_request();
REVOKE ALL ON public.community_channel_link_requests FROM PUBLIC,anon,authenticated,service_role;
GRANT INSERT,SELECT ON public.community_channel_link_requests TO authenticated;

CREATE TABLE public.community_post_create_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),requested_by uuid NOT NULL DEFAULT public.current_profile_id(),
 payload jsonb NOT NULL,is_announcement boolean NOT NULL DEFAULT false,operation text NOT NULL DEFAULT 'CREATE' CHECK(operation IN('CREATE','UPDATE')),
 post_id uuid,result jsonb,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.community_post_create_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_requests_insert ON public.community_post_create_requests FOR INSERT TO authenticated WITH CHECK(public.is_current_profile(requested_by));
CREATE POLICY post_requests_read ON public.community_post_create_requests FOR SELECT TO authenticated USING(public.is_current_profile(requested_by));
CREATE FUNCTION community_security.apply_post_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT public.is_current_profile(NEW.requested_by) OR NOT public.is_current_profile((NEW.payload->>'author_id')::uuid) THEN
   RAISE EXCEPTION '본인 계정으로만 글을 남길 수 있습니다.' USING ERRCODE='42501'; END IF;
 IF NEW.operation='UPDATE' THEN
   IF NOT EXISTS(SELECT 1 FROM public.community_channel_posts WHERE id=(NEW.payload->>'post_id')::uuid AND author_id=NEW.requested_by) THEN
     RAISE EXCEPTION '본인 글만 수정할 수 있습니다.' USING ERRCODE='42501'; END IF;
   NEW.result:=public.update_community_post_with_media(NEW.payload); NEW.post_id:=(NEW.result->>'id')::uuid;
 ELSE NEW.post_id:=public.create_community_post_with_media(NEW.payload,NEW.is_announcement); END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER apply_post_request BEFORE INSERT ON public.community_post_create_requests FOR EACH ROW EXECUTE FUNCTION community_security.apply_post_request();
REVOKE ALL ON public.community_post_create_requests FROM PUBLIC,anon,authenticated,service_role;
GRANT INSERT,SELECT ON public.community_post_create_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.queue_community_post_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE local_time timestamp:=NEW.created_at AT TIME ZONE 'Asia/Seoul';
BEGIN
 IF NEW.deleted_at IS NOT NULL OR NEW.is_hidden OR NOT public.community_channel_is_active(NEW.channel_id) THEN RETURN NEW; END IF;
 IF EXTRACT(HOUR FROM local_time)<9 THEN
   INSERT INTO public.community_post_push_digests(channel_id,user_id,local_date,post_ids,next_attempt_at)
   SELECT NEW.channel_id,m.user_id,local_time::date,ARRAY[NEW.id],(local_time::date+time '09:00') AT TIME ZONE 'Asia/Seoul'
   FROM community_security.member_ids(NEW.channel_id) m WHERE m.user_id<>NEW.author_id
   ON CONFLICT(channel_id,user_id,local_date) DO UPDATE SET
     post_ids=CASE WHEN NEW.id=ANY(public.community_post_push_digests.post_ids) THEN public.community_post_push_digests.post_ids
       ELSE array_append(public.community_post_push_digests.post_ids,NEW.id) END,updated_at=now();
 ELSE
   INSERT INTO public.community_post_push_recipients(post_id,user_id)
   SELECT NEW.id,m.user_id FROM community_security.member_ids(NEW.channel_id) m WHERE m.user_id<>NEW.author_id ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.queue_community_comment_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
    v_post public.community_channel_posts%ROWTYPE;
    v_channel public.community_channels%ROWTYPE;
    v_local_time timestamp := NEW.created_at AT TIME ZONE 'Asia/Seoul';
BEGIN
    IF NEW.is_hidden THEN RETURN NEW; END IF;
    SELECT * INTO v_post FROM public.community_channel_posts WHERE id = NEW.post_id;
    IF NOT FOUND OR v_post.deleted_at IS NOT NULL OR v_post.is_hidden
       OR v_post.author_id = NEW.user_id THEN RETURN NEW; END IF;
    SELECT * INTO v_channel FROM public.community_channels
        WHERE id = v_post.channel_id AND public.community_channel_is_active(id);
    IF NOT FOUND THEN RETURN NEW; END IF;
    IF EXTRACT(HOUR FROM v_local_time) < 9 THEN
        INSERT INTO public.community_post_push_digests(
            channel_id, user_id, local_date, comment_ids, next_attempt_at
        ) VALUES (
            v_channel.id, v_post.author_id, v_local_time::date, ARRAY[NEW.id],
            (v_local_time::date + time '09:00') AT TIME ZONE 'Asia/Seoul'
        ) ON CONFLICT (channel_id, user_id, local_date) DO UPDATE
        SET comment_ids = CASE
                WHEN NEW.id = ANY(public.community_post_push_digests.comment_ids)
                THEN public.community_post_push_digests.comment_ids
                ELSE array_append(public.community_post_push_digests.comment_ids, NEW.id)
            END,
            updated_at = now();
    ELSE
        INSERT INTO public.community_comment_push_recipients(comment_id, post_id, user_id)
        VALUES (NEW.id, NEW.post_id, v_post.author_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Private helper functions are available only through checked public interfaces and views.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA community_security FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
