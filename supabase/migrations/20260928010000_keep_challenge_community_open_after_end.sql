-- Keep an online challenge community conversational after its mission period.
-- Mission submissions remain period-bound by prepare_online_challenge_submission().

BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_community_channel(
    p_channel_id uuid,
    p_profile_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT public.is_current_staff()
    OR EXISTS (
        SELECT 1
        FROM public.community_channels c
        JOIN public.notices n ON n.id = c.source_notice_id
        JOIN public.notice_responses nr
          ON nr.notice_id = c.source_notice_id
         AND nr.status = 'JOIN'
        WHERE c.id = p_channel_id
          AND c.status <> 'CLOSED'
          AND n.is_challenge
          AND n.challenge_format = 'ONLINE'
          AND n.community_enabled
          AND nr.user_id = account_security.current_profile_id()
    )
    OR EXISTS (
        SELECT 1
        FROM public.community_channels c
        JOIN public.community_channel_members m ON m.channel_id = c.id
        WHERE c.id = p_channel_id
          AND c.source_notice_id IS NULL
          AND c.channel_type = 'PRIVATE'
          AND c.status = 'ACTIVE'
          AND m.user_id = account_security.current_profile_id()
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_community_channel(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_community_channel(uuid, uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS channel_comments_insert ON public.community_channel_comments;
CREATE POLICY channel_comments_insert ON public.community_channel_comments
FOR INSERT TO authenticated WITH CHECK (
    public.is_current_profile(user_id)
    AND public.can_access_community_channel((
        SELECT post.channel_id
        FROM public.community_channel_posts post
        WHERE post.id = post_id AND post.deleted_at IS NULL
    ))
);

DROP POLICY IF EXISTS channel_posts_insert ON public.community_channel_posts;
CREATE POLICY channel_posts_insert ON public.community_channel_posts
FOR INSERT TO authenticated WITH CHECK (
    public.is_current_profile(author_id)
    AND public.can_access_community_channel(channel_id, author_id)
    AND EXISTS (
        SELECT 1 FROM public.community_channels channel
        WHERE channel.id = channel_id AND channel.status = 'ACTIVE'
    )
);

CREATE OR REPLACE FUNCTION public.create_online_challenge_post(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_post_id uuid;
    v_channel_id uuid;
    v_author_id uuid := (p_payload->>'author_id')::uuid;
    v_mission_id uuid := NULLIF(p_payload->>'mission_id', '')::uuid;
    v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
    v_start_date date;
    v_end_date date;
BEGIN
    IF length(trim(COALESCE(p_payload->>'content', ''))) = 0 THEN
        RAISE EXCEPTION '글 내용을 입력해주세요.' USING ERRCODE = '23514';
    END IF;

    SELECT channel.id, notice.program_start_date, notice.program_end_date
    INTO v_channel_id, v_start_date, v_end_date
    FROM public.community_channels channel
    JOIN public.notices notice ON notice.id = channel.source_notice_id
    WHERE channel.source_notice_id = (p_payload->>'notice_id')::bigint
      AND channel.status = 'ACTIVE'
      AND notice.is_challenge
      AND notice.challenge_format = 'ONLINE'
      AND notice.community_enabled;
    IF NOT FOUND THEN
        RAISE EXCEPTION '사용 가능한 챌린지 커뮤니티가 없습니다.' USING ERRCODE = '23503';
    END IF;

    IF v_today < v_start_date THEN
        RAISE EXCEPTION '챌린지 시작 전에는 글을 등록할 수 없습니다.' USING ERRCODE = '23514';
    END IF;
    IF v_mission_id IS NOT NULL AND v_today > v_end_date THEN
        RAISE EXCEPTION '종료된 챌린지에는 미션 인증 글을 등록할 수 없습니다.' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.community_channel_posts(channel_id, author_id, content)
    VALUES (v_channel_id, v_author_id, trim(p_payload->>'content'))
    RETURNING id INTO v_post_id;

    IF NULLIF(p_payload->>'image_url', '') IS NOT NULL THEN
        INSERT INTO public.community_post_media(post_id, media_url)
        VALUES (v_post_id, p_payload->>'image_url');
    END IF;

    IF v_mission_id IS NOT NULL THEN
        INSERT INTO public.online_challenge_submissions(
            challenge_id, mission_id, participant_id, post_id, completion_date, completion_key
        ) VALUES (
            (p_payload->>'notice_id')::bigint,
            v_mission_id,
            v_author_id,
            v_post_id,
            v_today,
            v_post_id::text
        );
    END IF;
    RETURN v_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_online_challenge_post(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_online_challenge_post(jsonb) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
