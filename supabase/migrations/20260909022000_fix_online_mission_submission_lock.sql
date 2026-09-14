-- A participant can read an active online mission but cannot update it. The
-- submission trigger takes a row lock to serialize flexible-count completion,
-- so run only that validation/lock step with the function owner's privileges.
-- The caller is still checked against the submitted participant profile and
-- the INSERT itself remains protected by RLS.

CREATE OR REPLACE FUNCTION public.prepare_online_challenge_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_mission public.online_challenge_missions%ROWTYPE;
    v_notice public.notices%ROWTYPE;
    v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
    v_count integer;
BEGIN
    IF NOT public.is_current_profile(NEW.participant_id)
       AND NOT public.is_community_admin() THEN
        RAISE EXCEPTION '본인의 챌린지 기록만 등록할 수 있습니다.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_mission
    FROM public.online_challenge_missions
    WHERE id = NEW.mission_id AND is_active
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '선택한 온라인 미션을 찾을 수 없습니다.' USING ERRCODE = '23503';
    END IF;

    SELECT * INTO v_notice FROM public.notices WHERE id = v_mission.challenge_id;
    IF NOT v_notice.is_challenge
       OR v_notice.challenge_format <> 'ONLINE'
       OR NOT v_notice.community_enabled THEN
        RAISE EXCEPTION '온라인 커뮤니티 챌린지가 아닙니다.' USING ERRCODE = '23514';
    END IF;
    IF v_today < v_notice.program_start_date OR v_today > v_notice.program_end_date THEN
        RAISE EXCEPTION '챌린지 수행 기간이 아닙니다.' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.notice_responses nr
        WHERE nr.notice_id = v_notice.id
          AND nr.user_id = NEW.participant_id
          AND nr.status = 'JOIN'
    ) THEN
        RAISE EXCEPTION '챌린지 참여자만 기록할 수 있습니다.' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM public.community_channel_posts p
        JOIN public.community_channels c ON c.id = p.channel_id
        WHERE p.id = NEW.post_id
          AND p.author_id = NEW.participant_id
          AND p.deleted_at IS NULL
          AND c.source_notice_id = v_notice.id
    ) THEN
        RAISE EXCEPTION '게시글과 미션 정보가 일치하지 않습니다.' USING ERRCODE = '23514';
    END IF;

    NEW.challenge_id := v_notice.id;
    NEW.completion_date := v_today;
    IF v_mission.schedule_type = 'FIXED_DATE' THEN
        IF v_today <> v_mission.fixed_date THEN
            RAISE EXCEPTION '오늘 수행할 수 없는 미션입니다.' USING ERRCODE = '23514';
        END IF;
        NEW.completion_key := 'fixed';
    ELSIF v_mission.schedule_type = 'DAILY' THEN
        NEW.completion_key := v_today::text;
    ELSE
        SELECT count(*) INTO v_count
        FROM public.online_challenge_submissions
        WHERE mission_id = v_mission.id
          AND participant_id = NEW.participant_id
          AND is_valid;
        IF v_count >= v_mission.target_count THEN
            RAISE EXCEPTION '이미 목표 횟수를 완료했습니다.' USING ERRCODE = '23514';
        END IF;
        NEW.completion_key := NEW.post_id::text;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_online_challenge_submission() FROM PUBLIC;

