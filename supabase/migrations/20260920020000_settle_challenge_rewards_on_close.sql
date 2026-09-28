-- Challenge rewards are settled once when the program is marked COMPLETED.
-- Existing transactions and completion rows are preserved.

-- Stop the old online insert trigger from paying before program completion.
CREATE OR REPLACE FUNCTION public.try_award_online_challenge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- A challenge's feedback survey must not issue its program reward separately.
DO $$
DECLARE v_before text; v_after text;
BEGIN
  v_before := pg_get_functiondef('public.reward_survey_entry()'::regprocedure);
  v_after := replace(v_before,
    'IF NOT coalesce(program.is_review_required,false) OR coalesce(program.haifn_reward,0)<=0 THEN RETURN NEW; END IF;',
    'IF coalesce(program.is_challenge,false) OR NOT coalesce(program.is_review_required,false) OR coalesce(program.haifn_reward,0)<=0 THEN RETURN NEW; END IF;');
  IF v_after = v_before THEN RAISE EXCEPTION 'Survey reward function changed; review required'; END IF;
  EXECUTE v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_challenge_rewards_on_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
          (SELECT count(*)::integer FROM public.online_challenge_submissions s
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
$$;

DROP TRIGGER IF EXISTS trg_settle_challenge_rewards_on_close ON public.notices;
CREATE TRIGGER trg_settle_challenge_rewards_on_close
AFTER UPDATE OF program_status ON public.notices FOR EACH ROW
WHEN (NEW.program_status = 'COMPLETED' AND OLD.program_status IS DISTINCT FROM NEW.program_status)
EXECUTE FUNCTION public.settle_challenge_rewards_on_close();

NOTIFY pgrst, 'reload schema';
