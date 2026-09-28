-- Hosts may correct a post's mission for the mission day of that post.
-- No existing submission or raw log is deleted.
CREATE OR REPLACE FUNCTION public.is_challenge_host(p_notice_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_current_staff() AND EXISTS (
    SELECT 1 FROM public.notices n
    JOIN public.users u ON u.auth_user_id = auth.uid() OR u.id = auth.uid()
    WHERE n.id = p_notice_id AND n.is_challenge AND n.challenge_format = 'ONLINE'
      AND (n.host_id = u.id OR u.id = ANY(COALESCE(n.host_ids, '{}'::uuid[]))
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(n.hosts) = 'array' THEN n.hosts ELSE '[]'::jsonb END) h
                   WHERE h->>'host_id' = u.id::text))
  );
$$;
REVOKE ALL ON FUNCTION public.is_challenge_host(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_challenge_host(bigint) TO authenticated;

-- The existing insert trigger normally uses the current mission day. For a
-- host correction only, use the day of the linked post. Abort if the reviewed
-- trigger body has changed rather than silently weakening its checks.
DO $$
DECLARE v_before text; v_after text;
BEGIN
  v_before := pg_get_functiondef('public.prepare_online_challenge_submission()'::regprocedure);
  v_after := replace(v_before,
    'AND NOT public.is_community_admin() THEN',
    'AND NOT public.is_community_admin()
       AND NOT public.is_challenge_host((SELECT challenge_id FROM public.online_challenge_missions WHERE id = NEW.mission_id)) THEN');
  IF v_after = v_before THEN RAISE EXCEPTION 'Submission authorization changed; review required'; END IF;
  v_before := v_after;
  v_after := replace(v_before,
    'SELECT * INTO v_notice FROM public.notices WHERE id = v_mission.challenge_id;',
    'SELECT * INTO v_notice FROM public.notices WHERE id = v_mission.challenge_id;
    IF public.is_challenge_host(v_notice.id) AND NEW.completion_date = ((SELECT created_at FROM public.community_channel_posts WHERE id = NEW.post_id) AT TIME ZONE ''Asia/Seoul'')::date THEN
      v_today := NEW.completion_date;
    END IF;');
  IF v_after = v_before THEN RAISE EXCEPTION 'Submission trigger changed; review required'; END IF;
  EXECUTE v_after;
END;
$$;

DROP POLICY IF EXISTS online_submissions_insert ON public.online_challenge_submissions;
CREATE POLICY online_submissions_insert ON public.online_challenge_submissions FOR INSERT
  WITH CHECK (public.is_current_profile(participant_id) OR public.is_challenge_host(challenge_id));
DROP POLICY IF EXISTS online_submissions_update ON public.online_challenge_submissions;
CREATE POLICY online_submissions_update ON public.online_challenge_submissions FOR UPDATE
  USING (public.is_current_profile(participant_id) OR public.is_challenge_host(challenge_id))
  WITH CHECK (public.is_current_profile(participant_id) OR public.is_challenge_host(challenge_id));
DROP POLICY IF EXISTS online_submissions_read ON public.online_challenge_submissions;
CREATE POLICY online_submissions_read ON public.online_challenge_submissions FOR SELECT
  USING (public.is_community_admin() OR public.is_challenge_host(challenge_id)
    OR public.is_current_profile(participant_id)
    OR EXISTS (SELECT 1 FROM public.notice_responses nr WHERE nr.notice_id = challenge_id
      AND nr.status = 'JOIN' AND public.is_current_profile(nr.user_id)));
DROP POLICY IF EXISTS offline_submissions_read ON public.offline_challenge_submissions;
CREATE POLICY offline_submissions_read ON public.offline_challenge_submissions FOR SELECT
  USING (public.is_community_admin() OR public.is_challenge_host(challenge_id)
    OR public.is_current_profile(participant_id)
    OR EXISTS (SELECT 1 FROM public.notice_responses nr WHERE nr.notice_id = challenge_id
      AND nr.status = 'JOIN' AND public.is_current_profile(nr.user_id)));

CREATE OR REPLACE FUNCTION public.admin_set_online_post_mission(p_post_id uuid, p_mission_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF v_mission.schedule_type = 'FIXED_DATE' THEN
    IF v_mission.fixed_date <> v_day THEN RAISE EXCEPTION '글 작성일과 미션 날짜가 다릅니다.' USING ERRCODE = '23514'; END IF;
    v_key := 'fixed';
  ELSIF v_mission.schedule_type = 'DAILY' THEN
    v_key := v_day::text;
  ELSE
    SELECT count(*) INTO v_count FROM public.online_challenge_submissions
      WHERE mission_id = p_mission_id AND participant_id = v_post.author_id AND is_valid AND post_id <> p_post_id;
    IF v_count >= v_mission.target_count THEN RAISE EXCEPTION '이미 목표 횟수를 완료했습니다.' USING ERRCODE = '23514'; END IF;
    v_key := p_post_id::text;
  END IF;
  IF EXISTS (SELECT 1 FROM public.online_challenge_submissions
    WHERE mission_id = p_mission_id AND participant_id = v_post.author_id
      AND completion_key = v_key AND is_valid AND post_id <> p_post_id) THEN
    RAISE EXCEPTION '이 날짜의 미션은 다른 글로 이미 인증되었습니다.' USING ERRCODE = '23514';
  END IF;
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
$$;
REVOKE ALL ON FUNCTION public.admin_set_online_post_mission(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_online_post_mission(uuid, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
