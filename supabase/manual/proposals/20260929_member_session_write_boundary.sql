-- PROPOSAL ONLY: not applied to the linked Supabase project.
-- Review the live policy/function definitions and run the isolated and rollback
-- dry-runs before requesting explicit approval for any production schema change.
-- No application, attendance, user, or raw-log rows are modified by this DDL.
BEGIN;

DO $$
BEGIN
    IF to_regprocedure('public.respond_to_program_session(uuid,uuid,text)') IS NULL
       OR NOT EXISTS (
           SELECT 1 FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename = 'daily_program_session_responses'
             AND policyname = 'daily_session_responses_admin_insert'
       )
       OR NOT EXISTS (
           SELECT 1 FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename = 'daily_program_session_responses'
             AND policyname = 'daily_session_responses_admin_update'
       )
       OR NOT EXISTS (
           SELECT 1 FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename = 'daily_program_session_responses'
             AND policyname = 'daily_session_responses_read_own_or_admin'
       ) THEN
        RAISE EXCEPTION 'Expected session RPC or administrator/read policies are missing; review schema before applying';
    END IF;
END $$;

-- Keep the existing eligibility rules, but make retries idempotent and keep
-- cancellation/promotion within the same locked transaction. The current RPC
-- can turn a repeated JOIN into WAITLIST once the session is full.
CREATE OR REPLACE FUNCTION public.respond_to_program_session(
    p_session_id uuid, p_user_id uuid, p_action text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_session public.daily_program_sessions%ROWTYPE;
    v_program public.notices%ROWTYPE;
    v_join_count integer;
    v_existing_status text;
    v_status text;
    v_promote_user uuid;
BEGIN
    IF p_action IS NULL OR p_action NOT IN ('JOIN', 'WAITLIST', 'CANCEL') THEN
        RAISE EXCEPTION 'Invalid application action' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_user_id AND (id = auth.uid() OR auth_user_id = auth.uid())
    ) THEN
        RAISE EXCEPTION '신청자 정보를 확인할 수 없습니다.' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_session FROM public.daily_program_sessions
        WHERE id = p_session_id FOR UPDATE;
    IF NOT FOUND OR v_session.voided_at IS NOT NULL THEN
        RAISE EXCEPTION '회차 정보를 확인할 수 없습니다.';
    END IF;
    SELECT * INTO v_program FROM public.notices
        WHERE id = v_session.notice_id FOR SHARE;
    IF NOT FOUND OR v_program.category <> 'PROGRAM'
       OR v_program.is_challenge IS TRUE
       OR v_program.program_status IN ('COMPLETED', 'CANCELLED')
       OR coalesce(v_program.guest_properties->>'is_ended', 'false') = 'true'
       OR NOT (
           (v_program.is_recruiting IS TRUE
             AND v_program.guest_properties->>'schedule_mode' = 'RECURRING'
             AND v_program.guest_properties->>'application_scope' = 'SESSION')
           OR (v_program.is_recruiting IS FALSE
             AND v_program.guest_properties->>'open_participation_mode' = 'SESSION_RSVP')
       ) THEN
        RAISE EXCEPTION '회차별 신청이 비활성화되어 있습니다.';
    END IF;

    SELECT status INTO v_existing_status
        FROM public.daily_program_session_responses
        WHERE session_id = p_session_id AND user_id = p_user_id;
    IF p_action = 'CANCEL' THEN
        IF v_existing_status NOT IN ('JOIN', 'WAITLIST') OR v_existing_status IS NULL THEN
            RETURN jsonb_build_object('status', 'CANCELLED');
        END IF;
        UPDATE public.daily_program_session_responses
            SET status = 'CANCELLED', cancelled_at = now()
            WHERE session_id = p_session_id AND user_id = p_user_id;
        IF v_existing_status = 'JOIN' AND v_session.capacity > 0 THEN
            SELECT count(*) INTO v_join_count
                FROM public.daily_program_session_responses
                WHERE session_id = p_session_id AND status = 'JOIN';
            IF v_join_count < v_session.capacity THEN
                SELECT user_id INTO v_promote_user
                    FROM public.daily_program_session_responses
                    WHERE session_id = p_session_id AND status = 'WAITLIST'
                    ORDER BY created_at, user_id LIMIT 1 FOR UPDATE;
                IF v_promote_user IS NOT NULL THEN
                    UPDATE public.daily_program_session_responses
                        SET status = 'JOIN', cancelled_at = NULL
                        WHERE session_id = p_session_id AND user_id = v_promote_user;
                END IF;
            END IF;
        END IF;
        RETURN jsonb_build_object('status', 'CANCELLED');
    END IF;

    IF v_session.status <> 'OPEN' OR now() >= v_session.starts_at THEN
        RAISE EXCEPTION '신청이 마감되었습니다.';
    END IF;
    IF v_existing_status IN ('JOIN', 'WAITLIST') THEN
        RETURN jsonb_build_object('status', v_existing_status);
    END IF;
    SELECT count(*) INTO v_join_count
        FROM public.daily_program_session_responses
        WHERE session_id = p_session_id AND status = 'JOIN';
    v_status := CASE WHEN v_session.capacity > 0 AND v_join_count >= v_session.capacity
        THEN 'WAITLIST' ELSE 'JOIN' END;
    INSERT INTO public.daily_program_session_responses
        (session_id, user_id, status, cancelled_at)
        VALUES (p_session_id, p_user_id, v_status, NULL)
        ON CONFLICT (session_id, user_id) DO UPDATE
            SET status = EXCLUDED.status, cancelled_at = NULL, created_at = now();
    RETURN jsonb_build_object('status', v_status);
END $$;

-- PostgREST relation fallback. The view never exposes existing applications;
-- INSERT and the RPC both enter the same server-side transaction/row lock.
CREATE VIEW public.member_program_session_applications AS
    SELECT NULL::uuid AS session_id, NULL::uuid AS user_id,
           NULL::text AS action, NULL::text AS status
    WHERE false;

CREATE FUNCTION public.insert_member_program_session_application()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    IF NEW.action IS NULL OR NEW.action NOT IN ('JOIN', 'WAITLIST', 'CANCEL') THEN
        RAISE EXCEPTION 'Invalid application action' USING ERRCODE = '22023';
    END IF;
    NEW.status := public.respond_to_program_session(
        NEW.session_id, NEW.user_id, NEW.action
    )->>'status';
    RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.insert_member_program_session_application() FROM PUBLIC;
CREATE TRIGGER member_program_session_application_insert
    INSTEAD OF INSERT ON public.member_program_session_applications
    FOR EACH ROW EXECUTE FUNCTION public.insert_member_program_session_application();
REVOKE ALL ON public.member_program_session_applications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.member_program_session_applications TO authenticated;

-- The former FOR ALL policy let members bypass the capacity/queue transaction.
-- Keep the separate read-own and administrator INSERT/UPDATE policies intact.
DROP POLICY daily_session_responses_write_own
    ON public.daily_program_session_responses;

NOTIFY pgrst, 'reload schema';
COMMIT;
