-- A designated host may convert an in-progress DAILY online mission to
-- FLEXIBLE. Existing valid submissions for that mission remain one count each.
-- Lowering the target below existing counts marks those participants complete;
-- existing reward transactions are never altered.
DO $$
DECLARE v_before text; v_after text;
BEGIN
  v_before := pg_get_functiondef('public.sync_challenge_missions(bigint,text,jsonb)'::regprocedure);
  v_after := replace(v_before,
    'IF NOT public.is_community_admin() THEN',
    'IF NOT (public.is_community_admin() OR (p_format = ''ONLINE'' AND public.is_challenge_host(p_notice_id))) THEN');
  IF v_after = v_before THEN RAISE EXCEPTION 'Mission sync authorization changed; review required'; END IF;
  v_before := v_after;
  v_after := replace(v_before,
    'AND (current_mission.schedule_type IS DISTINCT FROM COALESCE(v_item->>''schedule_type'', ''FLEXIBLE'')
                       OR current_mission.fixed_date IS DISTINCT FROM NULLIF(v_item->>''fixed_date'', '''')::date
                       OR GREATEST(1, COALESCE(NULLIF(v_item->>''target_count'', '''')::integer, 1)) <
                          (SELECT count(*) FROM public.online_challenge_submissions s WHERE s.mission_id = v_id AND s.is_valid))',
    'AND (current_mission.schedule_type IS DISTINCT FROM COALESCE(v_item->>''schedule_type'', ''FLEXIBLE'')
                       OR current_mission.fixed_date IS DISTINCT FROM NULLIF(v_item->>''fixed_date'', '''')::date)
                  AND NOT (current_mission.schedule_type = ''DAILY''
                    AND COALESCE(v_item->>''schedule_type'', ''FLEXIBLE'') = ''FLEXIBLE''
                    AND public.is_challenge_host(p_notice_id))');
  IF v_after = v_before THEN RAISE EXCEPTION 'Mission sync function changed; review required'; END IF;
  EXECUTE v_after;

  v_before := pg_get_functiondef('public.validate_online_challenge_mission()'::regprocedure);
  v_after := replace(v_before,
    'AND (NEW.schedule_type IS DISTINCT FROM OLD.schedule_type OR NEW.fixed_date IS DISTINCT FROM OLD.fixed_date
            OR NEW.target_count < (SELECT count(*) FROM public.online_challenge_submissions s WHERE s.mission_id = OLD.id AND s.is_valid))',
    'AND (NEW.schedule_type IS DISTINCT FROM OLD.schedule_type OR NEW.fixed_date IS DISTINCT FROM OLD.fixed_date)
       AND NOT (OLD.schedule_type = ''DAILY'' AND NEW.schedule_type = ''FLEXIBLE''
         AND public.is_challenge_host(NEW.challenge_id))');
  IF v_after = v_before THEN RAISE EXCEPTION 'Mission guard function changed; review required'; END IF;
  EXECUTE v_after;
END;
$$;
DROP POLICY IF EXISTS online_missions_host_write ON public.online_challenge_missions;
CREATE POLICY online_missions_host_write ON public.online_challenge_missions FOR ALL
  TO authenticated USING (public.is_challenge_host(challenge_id))
  WITH CHECK (public.is_challenge_host(challenge_id));
NOTIFY pgrst, 'reload schema';
