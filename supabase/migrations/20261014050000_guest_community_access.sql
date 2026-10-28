-- Guest identity is scoped to one community. No account, credential or membership backfill.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='community_guest_worker') THEN
   CREATE ROLE community_guest_worker NOLOGIN NOINHERIT;
 END IF;
END $$;
GRANT community_guest_worker TO postgres;
GRANT USAGE ON SCHEMA public,community_security TO community_guest_worker;

CREATE TABLE community_security.guest_sessions(
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 channel_id uuid NOT NULL REFERENCES public.community_channels(id),
 profile_id uuid NOT NULL REFERENCES public.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '12 hours',
 revoked_at timestamptz
);
CREATE INDEX guest_sessions_profile_channel ON community_security.guest_sessions(profile_id,channel_id);
CREATE TABLE community_security.guest_verification_limits(
 key text NOT NULL,window_start timestamptz NOT NULL,hits integer NOT NULL DEFAULT 1,
 PRIMARY KEY(key,window_start)
);
REVOKE ALL ON community_security.guest_sessions,community_security.guest_verification_limits FROM PUBLIC,anon,authenticated,service_role,community_guest_worker;

CREATE FUNCTION community_security.current_profile_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN current_setting('role',true)='community_guest_worker' THEN
   (SELECT s.profile_id FROM community_security.guest_sessions s
      JOIN public.users u ON u.id=s.profile_id
    WHERE s.token_hash=current_setting('community.guest_token_hash',true)
      AND s.expires_at>now() AND s.revoked_at IS NULL
      AND u.user_group='게스트' AND u.status IS DISTINCT FROM 'withdrawn' AND u.status IS DISTINCT FROM 'deleted')
   ELSE account_security.current_profile_id() END;
$$;
CREATE FUNCTION community_security.is_current_profile(p_profile_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p_profile_id=community_security.current_profile_id();
$$;
CREATE OR REPLACE FUNCTION public.can_access_community_channel(p_channel_id uuid,p_profile_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT (current_setting('role',true)<>'community_guest_worker' OR EXISTS(
    SELECT 1 FROM community_security.guest_sessions s
    WHERE s.token_hash=current_setting('community.guest_token_hash',true) AND s.channel_id=p_channel_id
      AND s.expires_at>now() AND s.revoked_at IS NULL))
 AND (public.is_current_staff() OR EXISTS(
   SELECT 1 FROM public.community_channels c LEFT JOIN public.notices n ON n.id=c.source_notice_id
   WHERE c.id=p_channel_id AND community_security.effective_status(c.id)='ACTIVE'
     AND (c.source_notice_id IS NULL OR (n.category='PROGRAM' AND n.community_enabled))
     AND community_security.current_profile_id() IS NOT NULL
     AND (community_security.is_open_program(c.id) OR EXISTS(
       SELECT 1 FROM community_security.member_ids(c.id) m WHERE m.user_id=community_security.current_profile_id()))));
$$;

-- Preserve the shared atomic operations and their existing RLS for member sessions.
-- Only the identity assertion inside these community-specific functions is extended.
DO $$ DECLARE signature text; definition text; BEGIN
 FOREACH signature IN ARRAY ARRAY[
   'public.create_community_post_with_media(jsonb,boolean)',
   'public.update_community_post_with_media(jsonb)',
   'public.update_online_challenge_post(uuid,uuid,text,uuid)',
   'public.replace_community_post_media(uuid,uuid,text[],text[])',
   'public.mark_community_channel_read(uuid,uuid,timestamptz)'
 ] LOOP
   SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
   IF position('public.is_current_profile(' IN definition)=0 THEN
     RAISE EXCEPTION 'Unexpected community identity contract: %',signature;
   END IF;
   EXECUTE replace(definition,'public.is_current_profile(','community_security.is_current_profile(');
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION community_security.current_profile_id(),community_security.is_current_profile(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA community_security TO authenticated;
GRANT EXECUTE ON FUNCTION community_security.current_profile_id(),community_security.is_current_profile(uuid) TO authenticated,community_guest_worker;

CREATE FUNCTION community_security.profile_json(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',u.id,'name',u.name,'school',u.school,'profile_image_url',u.profile_image_url)
 FROM public.users u WHERE u.id=p_id;
$$;

CREATE FUNCTION community_security.guest_action(p_hash text,p_channel_id uuid,p_action text,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; c public.community_channels%ROWTYPE; n public.notices%ROWTYPE;
 target uuid; post public.community_channel_posts%ROWTYPE; result jsonb; active boolean; v_emoji text; v_content text;
 upload_count integer;
BEGIN
 IF current_setting('role',true)<>'community_guest_worker' OR p_hash !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>100000 THEN
   RAISE EXCEPTION 'guest_access_denied' USING ERRCODE='42501';
 END IF;
 PERFORM set_config('community.guest_token_hash',p_hash,true);
 IF p_action='logout' THEN
   UPDATE community_security.guest_sessions SET revoked_at=COALESCE(revoked_at,now())
     WHERE token_hash=p_hash AND channel_id=p_channel_id;
   RETURN 'true'::jsonb;
 END IF;
 actor:=community_security.current_profile_id();
 IF actor IS NULL OR NOT public.can_access_community_channel(p_channel_id) THEN
   RAISE EXCEPTION 'guest_access_denied' USING ERRCODE='42501';
 END IF;
 SELECT * INTO c FROM public.community_channels WHERE id=p_channel_id;
 SELECT * INTO n FROM public.notices WHERE id=c.source_notice_id;
 IF p_action IN('context','upload_context') THEN
   IF p_action='upload_context' THEN
     INSERT INTO community_security.guest_verification_limits(key,window_start)
       VALUES('upload:'||actor::text,date_bin(interval '15 minutes',now(),'2026-01-01'::timestamptz))
       ON CONFLICT(key,window_start) DO UPDATE SET hits=community_security.guest_verification_limits.hits+1
       RETURNING hits INTO upload_count;
     IF upload_count>30 THEN RAISE EXCEPTION 'upload_limited' USING ERRCODE='23514'; END IF;
   END IF;
   SELECT to_jsonb(d) INTO result FROM public.community_channel_directory_rows() d WHERE d.id=c.id;
   RETURN jsonb_build_object('channel',result,'user',community_security.profile_json(actor)||jsonb_build_object('user_group','게스트','account_role','member'),
     'challenge_access',EXISTS(SELECT 1 FROM public.notice_responses WHERE notice_id=n.id AND user_id=actor AND status='JOIN'),
     'notice',jsonb_build_object('id',n.id,'title',n.title,'is_challenge',n.is_challenge,'challenge_format',n.challenge_format,
       'community_enabled',n.community_enabled,'is_recruiting',n.is_recruiting,'program_start_date',n.program_start_date,'program_end_date',n.program_end_date,
       'challenge_missions',COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM public.online_challenge_missions m WHERE m.challenge_id=n.id AND m.is_active),'[]'::jsonb)));
 ELSIF p_action='posts' THEN
   SELECT COALESCE(jsonb_agg(to_jsonb(p)||jsonb_build_object(
     'author',community_security.profile_json(p.author_id),
     'media',COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.sort_order) FROM public.community_post_media m WHERE m.post_id=p.id),'[]'::jsonb),
     'submission',(SELECT to_jsonb(s)||jsonb_build_object('online_challenge_missions',to_jsonb(m)) FROM public.online_challenge_submissions s JOIN public.online_challenge_missions m ON m.id=s.mission_id WHERE s.post_id=p.id AND s.is_valid LIMIT 1),
     'community_channel_reactions',COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id',r.user_id,'emoji',r.emoji,'users',community_security.profile_json(r.user_id))) FROM public.community_channel_reactions r WHERE r.post_id=p.id),'[]'::jsonb),
     'community_channel_comments',COALESCE((SELECT jsonb_agg(to_jsonb(cm)||jsonb_build_object('author',community_security.profile_json(cm.user_id),
       'community_channel_comment_reactions',COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id',cr.user_id,'emoji',cr.emoji,'users',community_security.profile_json(cr.user_id))) FROM public.community_channel_comment_reactions cr WHERE cr.comment_id=cm.id),'[]'::jsonb)))
       FROM public.community_channel_comments cm WHERE cm.post_id=p.id AND cm.deleted_at IS NULL AND NOT cm.is_hidden),'[]'::jsonb)) ORDER BY p.created_at DESC),'[]'::jsonb)
     INTO result FROM public.community_channel_posts p WHERE p.channel_id=c.id AND p.deleted_at IS NULL AND NOT p.is_hidden;
   RETURN result;
 ELSIF p_action='candidates' THEN
   WITH hosts AS (
     SELECT n.host_id AS id UNION SELECT unnest(COALESCE(n.host_ids,'{}'::uuid[]))
     UNION SELECT NULLIF(h->>'host_id','')::uuid FROM jsonb_array_elements(CASE WHEN jsonb_typeof(n.hosts)='array' THEN n.hosts ELSE '[]'::jsonb END) h
   ), people AS (SELECT m.user_id AS id FROM community_security.member_ids(c.id) m UNION SELECT id FROM hosts)
   SELECT COALESCE(jsonb_agg(community_security.profile_json(p.id)||jsonb_build_object('isHost',EXISTS(SELECT 1 FROM hosts WHERE id=p.id))),'[]'::jsonb)
     INTO result FROM people p WHERE community_security.profile_json(p.id) IS NOT NULL;
   RETURN result;
 ELSIF p_action='submissions' THEN
   RETURN COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.online_challenge_submissions s WHERE s.challenge_id=n.id AND s.is_valid),'[]'::jsonb);
 ELSIF p_action='read_at' THEN
   RETURN to_jsonb((SELECT last_read_at FROM public.community_channel_read_cursors WHERE channel_id=c.id AND user_id=actor));
 ELSIF p_action='mark_read' THEN
   PERFORM public.mark_community_channel_read(c.id,actor,(p_payload->>'read_at')::timestamptz);
   RETURN 'true'::jsonb;
 ELSIF p_action='create_post' THEN
   RETURN to_jsonb(public.create_community_post_with_media(p_payload||jsonb_build_object('channel_id',c.id,'author_id',actor),false));
 ELSIF p_action='unused_paths' THEN
   IF jsonb_typeof(p_payload->'paths')<>'array' OR jsonb_array_length(p_payload->'paths')>10 THEN
     RAISE EXCEPTION 'invalid_paths' USING ERRCODE='22023';
   END IF;
   RETURN COALESCE((SELECT jsonb_agg(path) FROM jsonb_array_elements_text(p_payload->'paths') t(path)
     WHERE NOT EXISTS(SELECT 1 FROM public.community_post_media m WHERE m.media_url LIKE '%/notice-images/'||path)
       AND NOT EXISTS(SELECT 1 FROM public.community_channel_posts p WHERE p.image_url LIKE '%/notice-images/'||path)),'[]'::jsonb);
 END IF;

 target:=NULLIF(p_payload->>'id','')::uuid;
 IF p_action IN('edit_comment','delete_comment','comment_reaction') THEN
   SELECT p.* INTO post FROM public.community_channel_comments cm JOIN public.community_channel_posts p ON p.id=cm.post_id
     WHERE cm.id=target AND cm.deleted_at IS NULL AND NOT cm.is_hidden;
 ELSE
   SELECT * INTO post FROM public.community_channel_posts p WHERE p.id=target;
 END IF;
 IF post.id IS NULL OR post.channel_id<>c.id OR post.deleted_at IS NOT NULL OR post.is_hidden THEN
   RAISE EXCEPTION 'guest_access_denied' USING ERRCODE='42501';
 END IF;
 IF p_action IN('edit_post','delete_post') AND post.author_id<>actor THEN
   RAISE EXCEPTION 'guest_access_denied' USING ERRCODE='42501';
 END IF;
 IF p_action IN('edit_comment','delete_comment') AND NOT EXISTS(
   SELECT 1 FROM public.community_channel_comments WHERE id=target AND user_id=actor) THEN
   RAISE EXCEPTION 'guest_access_denied' USING ERRCODE='42501';
 END IF;
 v_content:=trim(COALESCE(p_payload->>'content',''));
 IF p_action IN('create_comment','edit_comment') AND (length(v_content)=0 OR length(v_content)>10000) THEN
   RAISE EXCEPTION 'invalid_content' USING ERRCODE='23514';
 END IF;
 CASE p_action
 WHEN 'edit_post' THEN
   RETURN public.update_community_post_with_media((p_payload-'id')||jsonb_build_object('post_id',post.id,'author_id',actor));
 WHEN 'delete_post' THEN
   UPDATE public.community_channel_posts SET deleted_at=now(),updated_at=now() WHERE id=post.id;
   RETURN 'true'::jsonb;
 WHEN 'create_comment' THEN
   INSERT INTO public.community_channel_comments(post_id,user_id,content) VALUES(post.id,actor,v_content) RETURNING id INTO target;
   RETURN to_jsonb(target);
 WHEN 'edit_comment' THEN
   UPDATE public.community_channel_comments SET content=v_content WHERE id=target;
   RETURN jsonb_build_object('id',target,'content',v_content);
 WHEN 'delete_comment' THEN
   UPDATE public.community_channel_comments SET deleted_at=now() WHERE id=target;
   RETURN 'true'::jsonb;
 WHEN 'post_reaction','comment_reaction' THEN
   v_emoji:=p_payload->>'emoji';
   IF length(v_emoji) NOT BETWEEN 1 AND 32 THEN RAISE EXCEPTION 'invalid_emoji' USING ERRCODE='23514'; END IF;
   PERFORM pg_advisory_xact_lock(hashtext(p_action||target::text||actor::text||v_emoji));
   IF p_action='post_reaction' THEN
     DELETE FROM public.community_channel_reactions r WHERE r.post_id=target AND r.user_id=actor AND r.emoji=v_emoji;
     active:=NOT FOUND;
     IF active THEN INSERT INTO public.community_channel_reactions(post_id,user_id,emoji) VALUES(target,actor,v_emoji); END IF;
   ELSE
     DELETE FROM public.community_channel_comment_reactions r WHERE r.comment_id=target AND r.user_id=actor AND r.emoji=v_emoji;
     active:=NOT FOUND;
     IF active THEN INSERT INTO public.community_channel_comment_reactions(comment_id,user_id,emoji) VALUES(target,actor,v_emoji); END IF;
   END IF;
   RETURN to_jsonb(active);
 ELSE RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023';
 END CASE;
END;
$$;

-- User-selected low-assurance guest entry: name + last four mobile digits.
-- This is not phone possession verification and never grants account access.
CREATE FUNCTION community_security.verify_guest(p_channel_id uuid,p_name text,p_pin text,
 p_client_key text,p_subject_key text,p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE counter integer; bucket timestamptz:=date_bin(interval '15 minutes',now(),'2026-01-01'::timestamptz);
 profile uuid; matches integer; limit_key text; c public.community_channels%ROWTYPE;
BEGIN
 IF current_setting('role',true)<>'community_guest_worker' OR p_client_key !~ '^[a-f0-9]{64}$'
   OR p_subject_key !~ '^[a-f0-9]{64}$' OR p_token_hash !~ '^[a-f0-9]{64}$'
   OR length(p_name) NOT BETWEEN 1 AND 100 OR p_pin !~ '^[0-9]{4}$' THEN
   RAISE EXCEPTION 'invalid_verification' USING ERRCODE='22023';
 END IF;
 FOREACH limit_key IN ARRAY ARRAY['client:'||p_client_key,'subject:'||p_subject_key] LOOP
   INSERT INTO community_security.guest_verification_limits(key,window_start) VALUES(limit_key,bucket)
     ON CONFLICT(key,window_start) DO UPDATE SET hits=community_security.guest_verification_limits.hits+1
     RETURNING hits INTO counter;
   IF counter>(CASE WHEN limit_key LIKE 'client:%' THEN 20 ELSE 5 END) THEN
     RETURN jsonb_build_object('allowed',false,'code','try_later');
   END IF;
 END LOOP;
 SELECT * INTO c FROM public.community_channels WHERE id=p_channel_id;
 IF c.source_notice_id IS NULL OR community_security.effective_status(c.id) IS DISTINCT FROM 'ACTIVE' THEN
   RETURN jsonb_build_object('allowed',false,'code','verification_failed');
 END IF;
 SELECT count(*),min(u.id::text)::uuid INTO matches,profile FROM public.users u
   JOIN community_security.member_ids(c.id) m ON m.user_id=u.id
   WHERE u.user_group='게스트' AND u.status IS DISTINCT FROM 'withdrawn' AND u.status IS DISTINCT FROM 'deleted'
     AND regexp_replace(trim(u.name),'\s*\(guest\)\s*$','','i')=p_name
     AND regexp_replace(COALESCE(u.phone,''),'[^0-9]','','g') ~ '^01[0-9]{8,9}$'
     AND right(regexp_replace(COALESCE(u.phone,''),'[^0-9]','','g'),4)=p_pin;
 IF matches<>1 THEN RETURN jsonb_build_object('allowed',false,'code','verification_failed'); END IF;
 INSERT INTO community_security.guest_sessions(token_hash,channel_id,profile_id) VALUES(p_token_hash,c.id,profile);
 RETURN jsonb_build_object('allowed',true,'context',community_security.guest_action(p_token_hash,c.id,'context','{}'));
END;
$$;
REVOKE ALL ON FUNCTION community_security.profile_json(uuid),community_security.guest_action(text,uuid,text,jsonb),
 community_security.verify_guest(uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION community_security.guest_action(text,uuid,text,jsonb),
 community_security.verify_guest(uuid,text,text,text,text,text) TO community_guest_worker;
NOTIFY pgrst,'reload schema';
COMMIT;
