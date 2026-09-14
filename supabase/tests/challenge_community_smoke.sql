BEGIN;

DO $$
DECLARE
    v_participant_id uuid;
    v_mission_id uuid;
    v_post_id uuid;
    v_submission_count integer;
    v_valid_count integer;
BEGIN
    SELECT user_id INTO v_participant_id
    FROM public.notice_responses
    WHERE notice_id = 119 AND status = 'JOIN'
    LIMIT 1;

    IF v_participant_id IS NULL THEN
        RAISE EXCEPTION 'Test challenge 119 needs one joined participant.';
    END IF;

    UPDATE public.notices SET community_enabled = true WHERE id = 119;

    INSERT INTO public.online_challenge_missions(
        challenge_id, title, description, schedule_type, target_count, sort_order
    ) VALUES (119, '통합 테스트 미션', '', 'FLEXIBLE', 2, 0)
    RETURNING id INTO v_mission_id;

    SELECT public.create_online_challenge_post(jsonb_build_object(
        'notice_id', 119,
        'author_id', v_participant_id,
        'mission_id', v_mission_id,
        'content', '롤백되는 온라인 챌린지 통합 테스트'
    )) INTO v_post_id;

    SELECT count(*) INTO v_submission_count
    FROM public.online_challenge_submissions
    WHERE post_id = v_post_id AND is_valid;
    IF v_submission_count <> 1 THEN
        RAISE EXCEPTION 'Post and submission were not created atomically.';
    END IF;

    UPDATE public.community_channel_posts SET deleted_at = now() WHERE id = v_post_id;
    SELECT count(*) INTO v_valid_count
    FROM public.online_challenge_submissions
    WHERE post_id = v_post_id AND is_valid;
    IF v_valid_count <> 0 THEN
        RAISE EXCEPTION 'Deleting a post did not invalidate its submission.';
    END IF;
END;
$$;

ROLLBACK;

