-- Mark a same-day daily-session application as attended when the member
-- checks in, regardless of which kiosk or mobile check-in path created it.
CREATE OR REPLACE FUNCTION public.mark_daily_program_attendance_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.type <> 'CHECKIN' THEN
        RETURN NEW;
    END IF;

    UPDATE public.daily_program_session_responses AS response
    SET is_attended = true
    FROM public.daily_program_sessions AS session
    WHERE response.session_id = session.id
      AND response.user_id = NEW.user_id
      AND response.status = 'JOIN'
      AND session.voided_at IS NULL
      AND session.session_date = (NEW.created_at AT TIME ZONE 'Asia/Seoul')::date
      AND response.is_attended = false;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_daily_program_attendance_on_checkin ON public.logs;
CREATE TRIGGER mark_daily_program_attendance_on_checkin
AFTER INSERT ON public.logs
FOR EACH ROW EXECUTE FUNCTION public.mark_daily_program_attendance_on_checkin();

-- A member may check in before joining the open program. In that order, mark
-- the application as attended as soon as it becomes a confirmed JOIN.
CREATE OR REPLACE FUNCTION public.mark_daily_program_attendance_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    session_day date;
BEGIN
    IF NEW.status <> 'JOIN' THEN
        RETURN NEW;
    END IF;

    SELECT session_date INTO session_day
    FROM public.daily_program_sessions
    WHERE id = NEW.session_id
      AND voided_at IS NULL;

    IF session_day IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.logs
        WHERE user_id = NEW.user_id
          AND type = 'CHECKIN'
          AND (created_at AT TIME ZONE 'Asia/Seoul')::date = session_day
    ) THEN
        NEW.is_attended = true;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_daily_program_attendance_on_join ON public.daily_program_session_responses;
CREATE TRIGGER mark_daily_program_attendance_on_join
BEFORE INSERT OR UPDATE OF status ON public.daily_program_session_responses
FOR EACH ROW EXECUTE FUNCTION public.mark_daily_program_attendance_on_join();

-- Bring today's already checked-in, confirmed applicants in line with the new
-- automatic behavior. Cancelled and waitlisted applications are not touched.
UPDATE public.daily_program_session_responses AS response
SET is_attended = true
FROM public.daily_program_sessions AS session
WHERE response.session_id = session.id
  AND response.status = 'JOIN'
  AND response.is_attended = false
  AND session.voided_at IS NULL
  AND session.session_date = (now() AT TIME ZONE 'Asia/Seoul')::date
  AND EXISTS (
      SELECT 1
      FROM public.logs
      WHERE user_id = response.user_id
        AND type = 'CHECKIN'
        AND (created_at AT TIME ZONE 'Asia/Seoul')::date = session.session_date
  );
