-- REVIEW REQUIRED. Do not apply to production without explicit approval.
-- Additive only: no existing users, applications or logs are removed.
-- Guest identification follows the existing public application form: exact
-- name, phone and birth match, restricted to guest profiles (never members).
-- This is permission to submit one application, not to log in/read a profile.
BEGIN;

ALTER TABLE public.daily_program_session_responses
    ADD COLUMN IF NOT EXISTS application_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.apply_guest_program_session(
    p_session_id uuid, p_user_id uuid, p_name text, p_phone text, p_birth text,
    p_answers jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_session public.daily_program_sessions%ROWTYPE;
    v_program public.notices%ROWTYPE;
    v_status text;
    v_count integer;
    v_field jsonb;
BEGIN
    IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR octet_length(p_answers::text) > 20000 THEN
        RAISE EXCEPTION '신청 내용을 확인해주세요.';
    END IF;
    -- Never grant guest privileges to a registered member or staff profile.
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id
        AND u.user_group = '게스트' AND u.role IN ('student', 'user')
        AND u.status IS DISTINCT FROM 'withdrawn'
        AND btrim(u.name) = btrim(p_name) AND length(btrim(p_name)) > 0
        AND u.birth::text = p_birth AND p_birth ~ '^[0-9]{6}$'
        AND regexp_replace(u.phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
        AND length(regexp_replace(p_phone, '[^0-9]', '', 'g')) = 11) THEN
        RAISE EXCEPTION '게스트 신청자 정보를 확인해주세요.' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_session FROM public.daily_program_sessions WHERE id = p_session_id FOR UPDATE;
    IF NOT FOUND OR v_session.voided_at IS NOT NULL
        OR v_session.session_date <> (now() AT TIME ZONE 'Asia/Seoul')::date
        OR v_session.status <> 'OPEN' OR now() >= v_session.starts_at THEN
        RAISE EXCEPTION '오늘 회차 신청이 마감되었습니다.';
    END IF;
    SELECT * INTO v_program FROM public.notices WHERE id = v_session.notice_id FOR SHARE;
    IF NOT FOUND OR v_program.category <> 'PROGRAM' OR v_program.is_recruiting IS DISTINCT FROM false
        OR v_program.is_challenge IS TRUE
        OR v_program.guest_properties->>'open_participation_mode' IS DISTINCT FROM 'SESSION_RSVP'
        OR v_program.guest_properties->>'allow_guest' = 'false'
        OR v_program.guest_properties->>'is_ended' = 'true'
        OR v_program.program_status IN ('COMPLETED', 'CANCELLED') THEN
        RAISE EXCEPTION '게스트 신청이 비활성화되어 있습니다.';
    END IF;
    FOR v_field IN SELECT value FROM jsonb_array_elements(COALESCE(v_program.guest_properties->'custom_fields', '[]'::jsonb)) LOOP
        IF v_field->>'required' = 'true' AND btrim(COALESCE(p_answers->>(v_field->>'id'), '')) = '' THEN
            RAISE EXCEPTION '필수 신청 항목을 입력해주세요.';
        END IF;
    END LOOP;
    -- Retrying cannot move an existing participant to the end of the waitlist.
    SELECT status INTO v_status FROM public.daily_program_session_responses
        WHERE session_id = p_session_id AND user_id = p_user_id;
    IF v_status IN ('JOIN', 'WAITLIST') THEN RETURN jsonb_build_object('status', v_status); END IF;
    SELECT count(*) INTO v_count FROM public.daily_program_session_responses
        WHERE session_id = p_session_id AND status = 'JOIN';
    v_status := CASE WHEN v_session.capacity > 0 AND v_count >= v_session.capacity THEN 'WAITLIST' ELSE 'JOIN' END;
    INSERT INTO public.daily_program_session_responses(session_id,user_id,status,application_answers,cancelled_at)
        VALUES(p_session_id,p_user_id,v_status,p_answers,NULL)
        ON CONFLICT(session_id,user_id) DO UPDATE SET status=EXCLUDED.status,
            application_answers=EXCLUDED.application_answers,cancelled_at=NULL,created_at=now();
    RETURN jsonb_build_object('status', v_status);
END $$;
REVOKE ALL ON FUNCTION public.apply_guest_program_session(uuid,uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_guest_program_session(uuid,uuid,text,text,text,jsonb) TO anon, authenticated;

-- PostgREST direct-table endpoint when the RPC schema cache is unavailable.
-- An empty insert-only view discloses no guest records. Its trigger executes
-- the identical validations/locking; no permissive response-table RLS added.
CREATE OR REPLACE VIEW public.guest_program_session_applications AS
    SELECT NULL::uuid AS session_id, NULL::uuid AS user_id, NULL::text AS name,
        NULL::text AS phone, NULL::text AS birth, NULL::jsonb AS application_answers,
        NULL::text AS status WHERE false;
CREATE OR REPLACE FUNCTION public.insert_guest_program_session_application()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.status := public.apply_guest_program_session(NEW.session_id, NEW.user_id,
        NEW.name, NEW.phone, NEW.birth, COALESCE(NEW.application_answers,'{}'::jsonb))->>'status';
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.insert_guest_program_session_application() FROM PUBLIC;
CREATE TRIGGER guest_program_session_application_insert
    INSTEAD OF INSERT ON public.guest_program_session_applications
    FOR EACH ROW EXECUTE FUNCTION public.insert_guest_program_session_application();
GRANT SELECT,INSERT ON public.guest_program_session_applications TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
