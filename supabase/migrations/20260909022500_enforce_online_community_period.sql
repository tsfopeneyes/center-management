-- Online challenge records are writable only during the challenge period,
-- including free-form posts made after all currently eligible missions are done.

DROP POLICY IF EXISTS channel_posts_insert ON public.community_channel_posts;
CREATE POLICY channel_posts_insert ON public.community_channel_posts FOR INSERT WITH CHECK (
    public.is_current_profile(author_id)
    AND public.can_access_community_channel(channel_id, author_id)
    AND EXISTS (
        SELECT 1
        FROM public.community_channels c
        LEFT JOIN public.notices n ON n.id = c.source_notice_id
        WHERE c.id = channel_id
          AND c.status = 'ACTIVE'
          AND (
              n.id IS NULL
              OR NOT n.is_challenge
              OR n.challenge_format <> 'ONLINE'
              OR (
                  n.program_start_date <= (now() AT TIME ZONE 'Asia/Seoul')::date
                  AND n.program_end_date >= (now() AT TIME ZONE 'Asia/Seoul')::date
              )
          )
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

    SELECT c.id, n.program_start_date, n.program_end_date
    INTO v_channel_id, v_start_date, v_end_date
    FROM public.community_channels c
    JOIN public.notices n ON n.id = c.source_notice_id
    WHERE c.source_notice_id = (p_payload->>'notice_id')::bigint
      AND c.status = 'ACTIVE'
      AND n.is_challenge
      AND n.challenge_format = 'ONLINE'
      AND n.community_enabled;
    IF NOT FOUND THEN
        RAISE EXCEPTION '사용 가능한 챌린지 커뮤니티가 없습니다.' USING ERRCODE = '23503';
    END IF;
    IF v_today < v_start_date OR v_today > v_end_date THEN
        RAISE EXCEPTION '챌린지 수행 기간이 아닙니다.' USING ERRCODE = '23514';
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

