-- Preserve every existing post, submission, mission ID and reward.
-- Allow additional mission posts; DAILY progress still counts distinct days,
-- and FLEXIBLE/FIXED_DATE totals remain capped by the existing reward logic.
BEGIN;
CREATE OR REPLACE FUNCTION public.prepare_online_challenge_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_mission public.online_challenge_missions%ROWTYPE;
    v_notice public.notices%ROWTYPE;
    v_today date := public.online_challenge_day();
    v_count integer;
BEGIN
    IF NOT public.is_current_profile(NEW.participant_id)
       AND NOT public.is_community_admin()
       AND NOT public.is_challenge_host((SELECT challenge_id FROM public.online_challenge_missions WHERE id = NEW.mission_id)) THEN
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
    IF public.is_challenge_host(v_notice.id) AND NEW.completion_date = ((SELECT created_at FROM public.community_channel_posts WHERE id = NEW.post_id) AT TIME ZONE 'Asia/Seoul')::date THEN
      v_today := NEW.completion_date;
    END IF;
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
    IF v_mission.schedule_type = 'FIXED_DATE' AND v_today <> v_mission.fixed_date THEN
        RAISE EXCEPTION '오늘 수행할 수 없는 미션입니다.' USING ERRCODE = '23514';
    END IF;
    -- Every post keeps its own mission link. Goals limit progress, not writing.
    NEW.completion_key := NEW.post_id::text;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_online_challenge_post(p_post_id uuid, p_author_id uuid, p_content text, p_mission_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_post public.community_channel_posts%ROWTYPE;
    v_notice public.notices%ROWTYPE;
    v_submission public.online_challenge_submissions%ROWTYPE;
    v_mission public.online_challenge_missions%ROWTYPE;
    v_old_mission_id uuid;
    v_today date := public.online_challenge_day();
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

            IF v_mission.schedule_type = 'FIXED_DATE' AND v_today <> v_mission.fixed_date THEN
                RAISE EXCEPTION '오늘 수행할 수 없는 미션입니다.' USING ERRCODE = '23514';
            END IF;
            v_completion_key := p_post_id::text;

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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_online_post_mission(p_post_id uuid, p_mission_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_post public.community_channel_posts%ROWTYPE;
  v_notice_id bigint;
  v_submission public.online_challenge_submissions%ROWTYPE;
  v_mission public.online_challenge_missions%ROWTYPE;
  v_day date;
  v_key text;
  v_count integer;
BEGIN
  SELECT * INTO v_post FROM public.community_channel_posts
    WHERE id = p_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '수정할 글을 찾을 수 없습니다.' USING ERRCODE = '23503'; END IF;
  SELECT c.source_notice_id INTO v_notice_id FROM public.community_channels c
    JOIN public.notices n ON n.id = c.source_notice_id
    WHERE c.id = v_post.channel_id AND n.is_challenge AND n.challenge_format = 'ONLINE';
  IF v_notice_id IS NULL OR NOT public.is_challenge_host(v_notice_id) THEN
    RAISE EXCEPTION '해당 챌린지 호스트만 미션을 수정할 수 있습니다.' USING ERRCODE = '42501';
  END IF;
  v_day := (v_post.created_at AT TIME ZONE 'Asia/Seoul')::date;
  SELECT * INTO v_submission FROM public.online_challenge_submissions
    WHERE post_id = p_post_id FOR UPDATE;
  IF v_submission.id IS NOT NULL AND v_submission.participant_id <> v_post.author_id THEN
    RAISE EXCEPTION '게시글과 미션 기록의 작성자가 다릅니다.' USING ERRCODE = '23514';
  END IF;
  IF p_mission_id IS NULL AND (v_submission.id IS NULL OR NOT v_submission.is_valid) THEN RETURN; END IF;
  IF p_mission_id = v_submission.mission_id AND v_submission.is_valid THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.challenge_completion_rewards
             WHERE challenge_id = v_notice_id AND participant_id = v_post.author_id) THEN
    RAISE EXCEPTION '완료 보상이 확정된 미션 기록은 변경할 수 없습니다.' USING ERRCODE = '23514';
  END IF;
  IF p_mission_id IS NULL THEN
    UPDATE public.online_challenge_submissions SET is_valid = false, invalidated_at = now()
      WHERE id = v_submission.id AND is_valid;
    RETURN;
  END IF;
  SELECT * INTO v_mission FROM public.online_challenge_missions
    WHERE id = p_mission_id AND challenge_id = v_notice_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '선택한 온라인 미션을 찾을 수 없습니다.' USING ERRCODE = '23503'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notices WHERE id = v_notice_id
    AND v_day BETWEEN program_start_date AND program_end_date)
    OR NOT EXISTS (SELECT 1 FROM public.notice_responses WHERE notice_id = v_notice_id
    AND user_id = v_post.author_id AND status = 'JOIN') THEN
    RAISE EXCEPTION '챌린지 기간 또는 참여 상태를 확인해 주세요.' USING ERRCODE = '23514';
  END IF;
  IF v_mission.schedule_type = 'FIXED_DATE' AND v_mission.fixed_date <> v_day THEN
    RAISE EXCEPTION '글 작성일과 미션 날짜가 다릅니다.' USING ERRCODE = '23514';
  END IF;
  v_key := p_post_id::text;
  IF v_submission.id IS NULL THEN
    INSERT INTO public.online_challenge_submissions
      (challenge_id, mission_id, participant_id, post_id, completion_date, completion_key)
      VALUES (v_notice_id, p_mission_id, v_post.author_id, p_post_id, v_day, v_key);
  ELSE
    UPDATE public.online_challenge_submissions SET mission_id = p_mission_id,
      completion_date = v_day, completion_key = v_key, is_valid = true, invalidated_at = NULL
      WHERE id = v_submission.id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.settle_challenge_rewards_on_close()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_required integer;
  v_completed integer;
  v_threshold integer;
  v_criterion text := COALESCE(NEW.guest_properties->>'challenge_reward_criterion', 'ALL');
  v_percent integer := CASE WHEN COALESCE(NEW.guest_properties->>'challenge_reward_percent', '') ~ '^[0-9]{1,3}$'
    THEN (NEW.guest_properties->>'challenge_reward_percent')::integer ELSE 100 END;
  v_transaction_id uuid;
BEGIN
  IF NEW.program_status IS DISTINCT FROM 'COMPLETED' OR OLD.program_status = 'COMPLETED'
     OR NOT NEW.is_challenge OR COALESCE(NEW.haifn_reward, 0) <= 0 THEN RETURN NEW; END IF;
  v_percent := LEAST(100, GREATEST(1, v_percent));
  IF v_criterion NOT IN ('FIRST_MISSION', 'PERCENT', 'ALL') THEN v_criterion := 'ALL'; END IF;

  FOR v_user IN SELECT DISTINCT nr.user_id FROM public.notice_responses nr
    WHERE nr.notice_id = NEW.id AND nr.status = 'JOIN' LOOP
    IF NEW.challenge_format = 'ONLINE' THEN
      SELECT COALESCE(sum(required), 0), COALESCE(sum(LEAST(required, completed)), 0)
      INTO v_required, v_completed FROM (
        SELECT CASE m.schedule_type WHEN 'DAILY' THEN (NEW.program_end_date - NEW.program_start_date + 1)
          WHEN 'FIXED_DATE' THEN 1 ELSE m.target_count END AS required,
          (SELECT CASE WHEN m.schedule_type='DAILY'
            THEN count(DISTINCT s.completion_date)::integer ELSE count(*)::integer END
            FROM public.online_challenge_submissions s
            WHERE s.mission_id = m.id AND s.participant_id = v_user.user_id AND s.is_valid) AS completed
        FROM public.online_challenge_missions m WHERE m.challenge_id = NEW.id AND m.is_active
      ) progress;
    ELSE
      SELECT count(*)::integer,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.offline_challenge_submissions s
          WHERE s.mission_id = m.id AND s.participant_id = v_user.user_id AND s.status = 'COMPLETED'))::integer
      INTO v_required, v_completed FROM public.offline_challenge_missions m
        WHERE m.challenge_id = NEW.id AND m.is_active;
    END IF;
    IF v_required <= 0 THEN CONTINUE; END IF;
    v_threshold := CASE v_criterion WHEN 'FIRST_MISSION' THEN 1
      WHEN 'PERCENT' THEN CEIL(v_required * v_percent / 100.0)::integer ELSE v_required END;
    IF v_completed < v_threshold THEN CONTINUE; END IF;

    INSERT INTO public.challenge_completion_rewards(challenge_id, participant_id)
      VALUES (NEW.id, v_user.user_id) ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN CONTINUE; END IF;
    -- A legacy program award must not become a second reward at close.
    IF EXISTS (SELECT 1 FROM public.haifn_transactions t WHERE t.user_id = v_user.user_id
      AND t.transaction_type = 'EARN' AND t.source_description IN (
        '[프로그램 참여] ' || NEW.title,
        '[프로그램 참여] ' || NEW.title || ' (리뷰 작성 완료)',
        '[설문 완료] 프로그램:' || NEW.id::text)) THEN CONTINUE; END IF;
    INSERT INTO public.haifn_transactions(user_id, amount, transaction_type, source_description, admin_id)
      VALUES (v_user.user_id, NEW.haifn_reward, 'EARN',
        '[챌린지 완료 #' || NEW.id || '] ' || NEW.title, NULL)
      RETURNING id INTO v_transaction_id;
    UPDATE public.challenge_completion_rewards SET transaction_id = v_transaction_id
      WHERE challenge_id = NEW.id AND participant_id = v_user.user_id;
  END LOOP;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_challenge_missions(p_notice_id bigint, p_format text, p_missions jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_item jsonb;
    v_ids uuid[] := ARRAY[]::uuid[];
    v_id uuid;
BEGIN
    IF NOT (public.is_community_admin() OR (p_format = 'ONLINE' AND public.is_challenge_host(p_notice_id))) THEN RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501'; END IF;
    IF p_format NOT IN ('ONLINE', 'OFFLINE') THEN RAISE EXCEPTION '올바르지 않은 챌린지 유형입니다.' USING ERRCODE = '23514'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.notices n
        WHERE n.id = p_notice_id AND n.is_challenge = true AND n.challenge_format = p_format
    ) THEN RAISE EXCEPTION '챌린지 유형이 일치하지 않습니다.' USING ERRCODE = '23514'; END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_missions, '[]'::jsonb)) LOOP
        v_id := COALESCE(NULLIF(v_item->>'id', '')::uuid, gen_random_uuid());
        v_ids := array_append(v_ids, v_id);
        IF p_format = 'ONLINE' THEN
            IF EXISTS (
                SELECT 1 FROM public.online_challenge_missions current_mission
                WHERE current_mission.id = v_id
                  AND EXISTS (SELECT 1 FROM public.online_challenge_submissions s WHERE s.mission_id = v_id AND s.is_valid)
                  AND (current_mission.schedule_type IS DISTINCT FROM COALESCE(v_item->>'schedule_type', 'FLEXIBLE')
                       OR current_mission.fixed_date IS DISTINCT FROM NULLIF(v_item->>'fixed_date', '')::date)
                  AND NOT (current_mission.schedule_type = 'DAILY'
                    AND COALESCE(v_item->>'schedule_type', 'FLEXIBLE') = 'FLEXIBLE'
                    AND public.is_challenge_host(p_notice_id))
            ) THEN RAISE EXCEPTION '수행 기록이 있는 온라인 미션의 방식·날짜·완료 횟수는 변경할 수 없습니다.' USING ERRCODE = '23514'; END IF;
            INSERT INTO public.online_challenge_missions(
                id, challenge_id, title, description, schedule_type, fixed_date,
                target_count, sort_order, is_active, updated_at
            ) VALUES (
                v_id, p_notice_id, trim(v_item->>'title'), COALESCE(v_item->>'description', ''),
                COALESCE(v_item->>'schedule_type', 'FLEXIBLE'), NULLIF(v_item->>'fixed_date', '')::date,
                GREATEST(1, COALESCE(NULLIF(v_item->>'target_count', '')::integer, 1)),
                COALESCE((v_item->>'sort_order')::integer, array_length(v_ids, 1) - 1), true, now()
            ) ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title, description = EXCLUDED.description,
                schedule_type = EXCLUDED.schedule_type, fixed_date = EXCLUDED.fixed_date,
                target_count = EXCLUDED.target_count, sort_order = EXCLUDED.sort_order,
                is_active = true, updated_at = now()
            WHERE online_challenge_missions.challenge_id = p_notice_id;
        ELSE
            INSERT INTO public.offline_challenge_missions(
                id, challenge_id, title, description, location, verification_type,
                sort_order, is_active, updated_at
            ) VALUES (
                v_id, p_notice_id, trim(v_item->>'title'), COALESCE(v_item->>'description', ''),
                COALESCE(v_item->>'location', ''), COALESCE(v_item->>'verification_type', 'PHOTO'),
                COALESCE((v_item->>'sort_order')::integer, array_length(v_ids, 1) - 1), true, now()
            ) ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title, description = EXCLUDED.description,
                location = EXCLUDED.location, verification_type = EXCLUDED.verification_type,
                sort_order = EXCLUDED.sort_order, is_active = true, updated_at = now()
            WHERE offline_challenge_missions.challenge_id = p_notice_id;
        END IF;
    END LOOP;

    IF p_format = 'ONLINE' THEN
        IF EXISTS (
            SELECT 1 FROM public.online_challenge_missions m
            WHERE m.challenge_id = p_notice_id AND m.is_active AND NOT (m.id = ANY(v_ids))
              AND EXISTS (SELECT 1 FROM public.online_challenge_submissions s WHERE s.mission_id = m.id AND s.is_valid)
        ) THEN RAISE EXCEPTION '수행 기록이 있는 온라인 미션은 삭제할 수 없습니다.' USING ERRCODE = '23514'; END IF;
        UPDATE public.online_challenge_missions SET is_active = false, updated_at = now()
        WHERE challenge_id = p_notice_id AND is_active AND NOT (id = ANY(v_ids));
        UPDATE public.offline_challenge_missions SET is_active = false, updated_at = now()
        WHERE challenge_id = p_notice_id AND is_active;
    ELSE
        IF EXISTS (
            SELECT 1 FROM public.offline_challenge_missions m
            WHERE m.challenge_id = p_notice_id AND m.is_active AND NOT (m.id = ANY(v_ids))
              AND EXISTS (SELECT 1 FROM public.offline_challenge_submissions s WHERE s.mission_id = m.id)
        ) THEN RAISE EXCEPTION '수행 기록이 있는 오프라인 미션은 삭제할 수 없습니다.' USING ERRCODE = '23514'; END IF;
        UPDATE public.offline_challenge_missions SET is_active = false, updated_at = now()
        WHERE challenge_id = p_notice_id AND is_active AND NOT (id = ANY(v_ids));
        UPDATE public.online_challenge_missions SET is_active = false, updated_at = now()
        WHERE challenge_id = p_notice_id AND is_active;
    END IF;
END;
$function$
;
NOTIFY pgrst,'reload schema';
COMMIT;
