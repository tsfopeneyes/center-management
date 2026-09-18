-- Edit a challenge post and its optional mission submission in one transaction.
-- A submitted mission that already finalized a completion reward stays immutable.

CREATE OR REPLACE FUNCTION public.update_online_challenge_post(
    p_post_id uuid,
    p_author_id uuid,
    p_content text,
    p_mission_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_post public.community_channel_posts%ROWTYPE;
    v_notice public.notices%ROWTYPE;
    v_submission public.online_challenge_submissions%ROWTYPE;
    v_mission public.online_challenge_missions%ROWTYPE;
    v_old_mission_id uuid;
    v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
    v_completion_key text;
    v_count integer;
BEGIN
    IF NOT public.is_current_profile(p_author_id) THEN
        RAISE EXCEPTION '본인 글만 수정할 수 있습니다.' USING ERRCODE = '42501';
    END IF;
    IF length(trim(COALESCE(p_content, ''))) = 0 THEN
        RAISE EXCEPTION '글 내용을 입력해주세요.' USING ERRCODE = '23514';
    END IF;

    SELECT p.* INTO v_post
    FROM public.community_channel_posts p
    WHERE p.id = p_post_id AND p.author_id = p_author_id AND p.deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '수정할 글을 찾을 수 없습니다.' USING ERRCODE = '42501';
    END IF;

    SELECT n.* INTO v_notice
    FROM public.community_channels c
    JOIN public.notices n ON n.id = c.source_notice_id
    WHERE c.id = v_post.channel_id AND c.status = 'ACTIVE'
      AND n.is_challenge AND n.challenge_format = 'ONLINE' AND n.community_enabled;
    IF NOT FOUND THEN
        RAISE EXCEPTION '온라인 챌린지 글이 아닙니다.' USING ERRCODE = '23514';
    END IF;

    SELECT * INTO v_submission
    FROM public.online_challenge_submissions
    WHERE post_id = p_post_id
    FOR UPDATE;
    IF v_submission.id IS NOT NULL AND v_submission.participant_id <> p_author_id THEN
        RAISE EXCEPTION '게시글과 미션 정보가 일치하지 않습니다.' USING ERRCODE = '23514';
    END IF;
    v_old_mission_id := CASE WHEN v_submission.is_valid THEN v_submission.mission_id ELSE NULL END;

    IF p_mission_id IS DISTINCT FROM v_old_mission_id THEN
        IF v_submission.is_valid AND EXISTS (
            SELECT 1 FROM public.challenge_completion_rewards r
            WHERE r.challenge_id = v_notice.id AND r.participant_id = p_author_id
        ) THEN
            RAISE EXCEPTION '챌린지 완료 보상이 확정된 미션 기록은 변경할 수 없습니다.' USING ERRCODE = '23514';
        END IF;

        IF p_mission_id IS NULL THEN
            IF v_submission.is_valid THEN
                UPDATE public.online_challenge_submissions
                SET is_valid = false, invalidated_at = now()
                WHERE id = v_submission.id;
            END IF;
        ELSE
            IF v_today < v_notice.program_start_date OR v_today > v_notice.program_end_date THEN
                RAISE EXCEPTION '챌린지 수행 기간이 아닙니다.' USING ERRCODE = '23514';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.notice_responses nr
                WHERE nr.notice_id = v_notice.id AND nr.user_id = p_author_id AND nr.status = 'JOIN'
            ) THEN
                RAISE EXCEPTION '챌린지 참여자만 기록할 수 있습니다.' USING ERRCODE = '42501';
            END IF;

            SELECT * INTO v_mission
            FROM public.online_challenge_missions
            WHERE id = p_mission_id AND challenge_id = v_notice.id AND is_active
            FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION '선택한 온라인 미션을 찾을 수 없습니다.' USING ERRCODE = '23503';
            END IF;

            IF v_mission.schedule_type = 'FIXED_DATE' THEN
                IF v_today <> v_mission.fixed_date THEN
                    RAISE EXCEPTION '오늘 수행할 수 없는 미션입니다.' USING ERRCODE = '23514';
                END IF;
                v_completion_key := 'fixed';
            ELSIF v_mission.schedule_type = 'DAILY' THEN
                v_completion_key := v_today::text;
            ELSE
                SELECT count(*) INTO v_count
                FROM public.online_challenge_submissions s
                WHERE s.mission_id = p_mission_id AND s.participant_id = p_author_id
                  AND s.is_valid AND s.post_id <> p_post_id;
                IF v_count >= v_mission.target_count THEN
                    RAISE EXCEPTION '이미 목표 횟수를 완료했습니다.' USING ERRCODE = '23514';
                END IF;
                v_completion_key := p_post_id::text;
            END IF;

            IF v_submission.id IS NULL THEN
                INSERT INTO public.online_challenge_submissions (
                    challenge_id, mission_id, participant_id, post_id, completion_date, completion_key
                ) VALUES (
                    v_notice.id, p_mission_id, p_author_id, p_post_id, v_today, v_completion_key
                );
            ELSE
                UPDATE public.online_challenge_submissions
                SET mission_id = p_mission_id, completion_date = v_today,
                    completion_key = v_completion_key, is_valid = true, invalidated_at = NULL
                WHERE id = v_submission.id;
            END IF;
        END IF;
    END IF;

    UPDATE public.community_channel_posts
    SET content = trim(p_content), updated_at = now()
    WHERE id = p_post_id
    RETURNING * INTO v_post;

    RETURN jsonb_build_object('id', v_post.id, 'content', v_post.content, 'updated_at', v_post.updated_at);
END;
$$;

-- The existing insert trigger awards a completed challenge. Reclassification
-- can also complete it when an invalid submission is restored or moved.
DROP TRIGGER IF EXISTS trg_award_online_challenge_on_edit ON public.online_challenge_submissions;
CREATE TRIGGER trg_award_online_challenge_on_edit
AFTER UPDATE OF mission_id, is_valid ON public.online_challenge_submissions
FOR EACH ROW
WHEN (NEW.is_valid AND (OLD.is_valid IS DISTINCT FROM NEW.is_valid OR OLD.mission_id IS DISTINCT FROM NEW.mission_id))
EXECUTE FUNCTION public.try_award_online_challenge();

REVOKE ALL ON FUNCTION public.update_online_challenge_post(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_online_challenge_post(uuid, uuid, text, uuid) TO authenticated;
