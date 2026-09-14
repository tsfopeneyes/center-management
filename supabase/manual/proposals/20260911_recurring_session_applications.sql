-- APPLIED TO PRODUCTION 2026-09-11 after explicit approval and successful rollback dry-run.
-- No rows, applications, attendance records, or raw logs are deleted.
BEGIN;

CREATE OR REPLACE FUNCTION public.respond_to_program_session(p_session_id uuid, p_user_id uuid, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_session public.daily_program_sessions%ROWTYPE; v_program public.notices%ROWTYPE; v_join_count integer; v_status text; v_promote_user uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_user_id AND (id=auth.uid() OR auth_user_id=auth.uid())) THEN
        RAISE EXCEPTION '신청자 정보를 확인할 수 없습니다.' USING ERRCODE='42501';
    END IF;
    SELECT * INTO v_session FROM public.daily_program_sessions WHERE id=p_session_id FOR UPDATE;
    IF NOT FOUND OR v_session.voided_at IS NOT NULL THEN RAISE EXCEPTION '회차 정보를 확인할 수 없습니다.'; END IF;
    SELECT * INTO v_program FROM public.notices WHERE id=v_session.notice_id FOR SHARE;
    IF NOT FOUND OR v_program.category <> 'PROGRAM' OR v_program.is_challenge IS TRUE
       OR v_program.program_status IN ('COMPLETED','CANCELLED')
       OR coalesce(v_program.guest_properties->>'is_ended','false')='true'
       OR NOT (
          (v_program.is_recruiting IS TRUE
             AND v_program.guest_properties->>'schedule_mode'='RECURRING'
             AND v_program.guest_properties->>'application_scope'='SESSION')
          OR (v_program.is_recruiting IS FALSE
             AND v_program.guest_properties->>'open_participation_mode'='SESSION_RSVP')
       ) THEN RAISE EXCEPTION '회차별 신청이 비활성화되어 있습니다.'; END IF;
    IF p_action='CANCEL' THEN
        UPDATE public.daily_program_session_responses SET status='CANCELLED',cancelled_at=now() WHERE session_id=p_session_id AND user_id=p_user_id;
        SELECT count(*) INTO v_join_count FROM public.daily_program_session_responses WHERE session_id=p_session_id AND status='JOIN';
        IF v_session.capacity > 0 AND v_join_count < v_session.capacity THEN
            SELECT user_id INTO v_promote_user FROM public.daily_program_session_responses
              WHERE session_id=p_session_id AND status='WAITLIST' ORDER BY created_at LIMIT 1 FOR UPDATE;
            IF v_promote_user IS NOT NULL THEN UPDATE public.daily_program_session_responses SET status='JOIN',cancelled_at=NULL WHERE session_id=p_session_id AND user_id=v_promote_user; END IF;
        END IF;
        RETURN jsonb_build_object('status','CANCELLED');
    END IF;
    IF v_session.status <> 'OPEN' OR now() >= v_session.starts_at THEN RAISE EXCEPTION '신청이 마감되었습니다.'; END IF;
    SELECT count(*) INTO v_join_count FROM public.daily_program_session_responses WHERE session_id=p_session_id AND status='JOIN';
    v_status := CASE WHEN v_session.capacity > 0 AND v_join_count >= v_session.capacity THEN 'WAITLIST' ELSE 'JOIN' END;
    INSERT INTO public.daily_program_session_responses(session_id,user_id,status,cancelled_at)
      VALUES(p_session_id,p_user_id,v_status,NULL)
      ON CONFLICT(session_id,user_id) DO UPDATE SET status=EXCLUDED.status,cancelled_at=NULL;
    RETURN jsonb_build_object('status',v_status);
END $$;

REVOKE ALL ON FUNCTION public.respond_to_program_session(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_program_session(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_guest_program_session(
    p_session_id uuid, p_user_id uuid, p_name text, p_phone text, p_birth text,
    p_answers jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_session public.daily_program_sessions%ROWTYPE; v_program public.notices%ROWTYPE;
    v_status text; v_count integer; v_field jsonb;
BEGIN
    IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR octet_length(p_answers::text) > 20000 THEN RAISE EXCEPTION '신청 내용을 확인해주세요.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id=p_user_id
        AND u.user_group='게스트' AND u.role IN ('student','user') AND u.status IS DISTINCT FROM 'withdrawn'
        AND btrim(u.name)=btrim(p_name) AND length(btrim(p_name))>0
        AND u.birth::text=p_birth AND p_birth ~ '^[0-9]{6}$'
        AND regexp_replace(u.phone,'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g')
        AND length(regexp_replace(p_phone,'[^0-9]','','g'))=11) THEN
        RAISE EXCEPTION '게스트 신청자 정보를 확인해주세요.' USING ERRCODE='42501';
    END IF;
    SELECT * INTO v_session FROM public.daily_program_sessions WHERE id=p_session_id FOR UPDATE;
    IF NOT FOUND OR v_session.voided_at IS NOT NULL OR v_session.status<>'OPEN' OR now()>=v_session.starts_at THEN RAISE EXCEPTION '회차 신청이 마감되었습니다.'; END IF;
    SELECT * INTO v_program FROM public.notices WHERE id=v_session.notice_id FOR SHARE;
    IF NOT FOUND OR v_program.category<>'PROGRAM' OR v_program.is_challenge IS TRUE
       OR v_program.guest_properties->>'allow_guest'='false'
       OR v_program.guest_properties->>'is_ended'='true'
       OR v_program.program_status IN ('COMPLETED','CANCELLED')
       OR NOT (
          (v_program.is_recruiting IS TRUE AND v_program.guest_properties->>'schedule_mode'='RECURRING' AND v_program.guest_properties->>'application_scope'='SESSION')
          OR (v_program.is_recruiting IS FALSE AND v_program.guest_properties->>'open_participation_mode'='SESSION_RSVP')
       ) THEN RAISE EXCEPTION '게스트 신청이 비활성화되어 있습니다.'; END IF;
    FOR v_field IN SELECT value FROM jsonb_array_elements(COALESCE(v_program.guest_properties->'custom_fields','[]'::jsonb)) LOOP
        IF v_field->>'required'='true' AND btrim(COALESCE(p_answers->>(v_field->>'id'),''))='' THEN RAISE EXCEPTION '필수 신청 항목을 입력해주세요.'; END IF;
    END LOOP;
    SELECT status INTO v_status FROM public.daily_program_session_responses WHERE session_id=p_session_id AND user_id=p_user_id;
    IF v_status IN ('JOIN','WAITLIST') THEN RETURN jsonb_build_object('status',v_status); END IF;
    SELECT count(*) INTO v_count FROM public.daily_program_session_responses WHERE session_id=p_session_id AND status='JOIN';
    v_status := CASE WHEN v_session.capacity>0 AND v_count>=v_session.capacity THEN 'WAITLIST' ELSE 'JOIN' END;
    INSERT INTO public.daily_program_session_responses(session_id,user_id,status,application_answers,cancelled_at)
      VALUES(p_session_id,p_user_id,v_status,p_answers,NULL)
      ON CONFLICT(session_id,user_id) DO UPDATE SET status=EXCLUDED.status,application_answers=EXCLUDED.application_answers,cancelled_at=NULL,created_at=now();
    RETURN jsonb_build_object('status',v_status);
END $$;
REVOKE ALL ON FUNCTION public.apply_guest_program_session(uuid,uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_guest_program_session(uuid,uuid,text,text,text,jsonb) TO anon, authenticated;

COMMIT;
