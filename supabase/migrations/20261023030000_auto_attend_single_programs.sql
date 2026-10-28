BEGIN;
-- Match the venue, not the applicant's school/target region. Unknown or
-- ambiguous venues never count as the same center.
CREATE FUNCTION public.program_attendance_center(p_location text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT CASE
 WHEN (p_location ~* '(하이픈|haifn)' OR btrim(p_location)='2F 스퀘어')
   AND p_location !~* '(이높|enough)' THEN 'HAIFN'
 WHEN p_location ~* '(이높|enough)' AND p_location !~* '(하이픈|haifn)' THEN 'ENOUGH_PLACE'
 ELSE NULL END;
$$;

CREATE FUNCTION public.mark_single_program_attendance_on_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE center_code text; checkin_day date;
BEGIN
 IF NEW.type IS DISTINCT FROM 'CHECKIN' THEN RETURN NEW; END IF;
 SELECT public.program_attendance_center(l.id || ' ' || coalesce(l.name,''))
 INTO center_code FROM public.locations l WHERE l.id=NEW.location_id;
 IF center_code IS NULL THEN RETURN NEW; END IF;
 checkin_day := (NEW.created_at AT TIME ZONE 'Asia/Seoul')::date;
 UPDATE public.notice_responses r SET is_attended=true FROM public.notices n
 WHERE r.notice_id=n.id AND r.user_id=NEW.user_id AND r.status='JOIN'
   AND r.is_attended IS NOT TRUE
   AND n.category='PROGRAM' AND n.is_recruiting IS TRUE
   AND n.is_challenge IS NOT TRUE AND n.program_status='ACTIVE'
   AND coalesce(n.guest_properties->>'schedule_mode','SINGLE')='SINGLE'
   AND coalesce(n.guest_properties->>'is_ended','false')<>'true'
   AND n.program_date >= (checkin_day::timestamp AT TIME ZONE 'Asia/Seoul')
   AND n.program_date < ((checkin_day+1)::timestamp AT TIME ZONE 'Asia/Seoul')
   AND public.program_attendance_center(n.program_location)=center_code;
 RETURN NEW;
END;
$$;

-- A check-in may precede the application or promotion from the waitlist.
CREATE FUNCTION public.mark_single_program_attendance_on_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE program_day date; center_code text;
BEGIN
 IF NEW.status IS DISTINCT FROM 'JOIN' OR NEW.is_attended IS TRUE THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.status='JOIN' THEN RETURN NEW; END IF;
 SELECT (n.program_date AT TIME ZONE 'Asia/Seoul')::date,
   public.program_attendance_center(n.program_location)
 INTO program_day,center_code FROM public.notices n
 WHERE n.id=NEW.notice_id AND n.category='PROGRAM' AND n.is_recruiting IS TRUE
   AND n.is_challenge IS NOT TRUE AND n.program_status='ACTIVE'
   AND coalesce(n.guest_properties->>'schedule_mode','SINGLE')='SINGLE'
   AND coalesce(n.guest_properties->>'is_ended','false')<>'true';
 IF center_code IS NULL OR program_day IS NULL THEN RETURN NEW; END IF;
 IF EXISTS (
   SELECT 1 FROM public.logs l JOIN public.locations location ON location.id=l.location_id
   WHERE l.user_id=NEW.user_id AND l.type='CHECKIN'
     AND l.created_at >= (program_day::timestamp AT TIME ZONE 'Asia/Seoul')
     AND l.created_at < ((program_day+1)::timestamp AT TIME ZONE 'Asia/Seoul')
     AND public.program_attendance_center(location.id || ' ' || coalesce(location.name,''))=center_code
 ) THEN NEW.is_attended=true; END IF;
 RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.program_attendance_center(text),
 public.mark_single_program_attendance_on_checkin(),public.mark_single_program_attendance_on_join()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER mark_single_program_attendance_on_checkin AFTER INSERT ON public.logs
 FOR EACH ROW EXECUTE FUNCTION public.mark_single_program_attendance_on_checkin();
CREATE TRIGGER mark_single_program_attendance_on_join BEFORE INSERT OR UPDATE OF status ON public.notice_responses
 FOR EACH ROW EXECUTE FUNCTION public.mark_single_program_attendance_on_join();
COMMIT;
