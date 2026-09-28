-- Record open-program attendance independently of its eventual Haifn reward.
CREATE TABLE IF NOT EXISTS public.open_program_attendance (
  notice_id bigint NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id, attendance_date)
);
ALTER TABLE public.open_program_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY open_program_attendance_staff ON public.open_program_attendance FOR ALL
  TO authenticated USING (public.is_current_staff()) WITH CHECK (public.is_current_staff());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.open_program_attendance TO authenticated;

-- Existing rewards are kept. A new unique ledger prevents a second grant if
-- completion is retried; legacy title-based transactions are checked too.
CREATE TABLE IF NOT EXISTS public.program_close_reward_grants (
  notice_id bigint NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attendance_date date,
  transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (notice_id, user_id, attendance_date)
);
ALTER TABLE public.program_close_reward_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY program_close_reward_grants_read ON public.program_close_reward_grants FOR SELECT
  TO authenticated USING (public.is_current_staff() OR public.is_current_profile(user_id));
GRANT SELECT ON public.program_close_reward_grants TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_program_rewards_on_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_attendee record;
  v_description text;
  v_transaction_id uuid;
BEGIN
  IF NEW.program_status IS DISTINCT FROM 'COMPLETED' OR OLD.program_status = 'COMPLETED'
     OR NEW.is_challenge OR COALESCE(NEW.haifn_reward, 0) <= 0 THEN RETURN NEW; END IF;

  FOR v_attendee IN
    SELECT nr.user_id, NULL::date AS attendance_date FROM public.notice_responses nr
      WHERE NEW.is_recruiting IS DISTINCT FROM FALSE
        AND nr.notice_id = NEW.id AND nr.status = 'JOIN' AND nr.is_attended
    UNION
    SELECT sr.user_id, NULL::date FROM public.daily_program_session_responses sr
      JOIN public.daily_program_sessions s ON s.id = sr.session_id
      WHERE NEW.is_recruiting IS DISTINCT FROM FALSE
        AND s.notice_id = NEW.id AND sr.status = 'JOIN' AND sr.is_attended
    UNION
    SELECT oa.user_id, oa.attendance_date FROM public.open_program_attendance oa
      WHERE NEW.is_recruiting = FALSE AND oa.notice_id = NEW.id
  LOOP
    v_description := CASE WHEN v_attendee.attendance_date IS NULL
      THEN '[프로그램 참여] ' || NEW.title
      ELSE '[오픈 프로그램 참여] ' || NEW.title || ' (' || v_attendee.attendance_date::text || ')' END;
    INSERT INTO public.program_close_reward_grants(notice_id, user_id, attendance_date)
      VALUES (NEW.id, v_attendee.user_id, v_attendee.attendance_date)
      ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.haifn_transactions t
      WHERE t.user_id = v_attendee.user_id AND t.transaction_type = 'EARN'
        AND t.source_description IN (v_description,
          '[프로그램 참여] ' || NEW.title || ' (리뷰 작성 완료)',
          '[설문 완료] 프로그램:' || NEW.id::text)) THEN CONTINUE; END IF;
    INSERT INTO public.haifn_transactions(user_id, amount, transaction_type, source_description)
      VALUES (v_attendee.user_id, NEW.haifn_reward, 'EARN', v_description)
      RETURNING id INTO v_transaction_id;
    UPDATE public.program_close_reward_grants SET transaction_id = v_transaction_id
      WHERE notice_id = NEW.id AND user_id = v_attendee.user_id
        AND attendance_date IS NOT DISTINCT FROM v_attendee.attendance_date;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_settle_program_rewards_on_close ON public.notices;
CREATE TRIGGER trg_settle_program_rewards_on_close
AFTER UPDATE OF program_status ON public.notices FOR EACH ROW
WHEN (NEW.program_status = 'COMPLETED' AND OLD.program_status IS DISTINCT FROM NEW.program_status)
EXECUTE FUNCTION public.settle_program_rewards_on_close();
-- Surveys collect feedback; the program reward is issued by the close trigger.
CREATE OR REPLACE FUNCTION public.reward_survey_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN NEW;
END;
$$;
NOTIFY pgrst, 'reload schema';
