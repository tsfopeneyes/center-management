CREATE TABLE IF NOT EXISTS public.daily_program_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notice_id bigint NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
    session_date date NOT NULL,
    starts_at timestamptz NOT NULL,
    menu text NOT NULL CHECK (length(trim(menu)) > 0),
    conversation_question text NOT NULL CHECK (length(trim(conversation_question)) > 0),
    capacity integer NOT NULL DEFAULT 0 CHECK (capacity >= 0),
    join_count integer NOT NULL DEFAULT 0 CHECK (join_count >= 0),
    status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (notice_id, session_date)
);

CREATE TABLE IF NOT EXISTS public.daily_program_session_responses (
    session_id uuid NOT NULL REFERENCES public.daily_program_sessions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'JOIN' CHECK (status IN ('JOIN', 'WAITLIST', 'CANCELLED')),
    is_attended boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    cancelled_at timestamptz,
    PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS daily_program_sessions_today_idx ON public.daily_program_sessions(session_date, status, notice_id);
CREATE INDEX IF NOT EXISTS daily_program_session_responses_status_idx ON public.daily_program_session_responses(session_id, status, created_at);

ALTER TABLE public.daily_program_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_program_session_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_program_sessions_read ON public.daily_program_sessions FOR SELECT USING (true);
CREATE POLICY daily_program_sessions_admin_insert ON public.daily_program_sessions FOR INSERT TO authenticated WITH CHECK (public.calendar_is_admin());
CREATE POLICY daily_program_sessions_admin_update ON public.daily_program_sessions FOR UPDATE TO authenticated USING (public.calendar_is_admin()) WITH CHECK (public.calendar_is_admin());
CREATE POLICY daily_session_responses_read_own_or_admin ON public.daily_program_session_responses FOR SELECT USING (
    public.calendar_is_admin() OR user_id IN (SELECT id FROM public.users WHERE id=auth.uid() OR auth_user_id=auth.uid())
);

CREATE OR REPLACE FUNCTION public.refresh_program_session_join_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_session_id uuid;
BEGIN
    v_session_id := CASE WHEN TG_OP='DELETE' THEN OLD.session_id ELSE NEW.session_id END;
    UPDATE public.daily_program_sessions SET join_count=(
        SELECT count(*) FROM public.daily_program_session_responses
        WHERE session_id=v_session_id AND status='JOIN'
    ),updated_at=now() WHERE id=v_session_id;
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER trg_program_session_join_count
AFTER INSERT OR UPDATE OR DELETE ON public.daily_program_session_responses
FOR EACH ROW EXECUTE FUNCTION public.refresh_program_session_join_count();
CREATE POLICY daily_session_responses_write_own ON public.daily_program_session_responses FOR ALL USING (
    user_id IN (SELECT id FROM public.users WHERE id=auth.uid() OR auth_user_id=auth.uid())
) WITH CHECK (user_id IN (SELECT id FROM public.users WHERE id=auth.uid() OR auth_user_id=auth.uid()));
CREATE POLICY daily_session_responses_admin_update ON public.daily_program_session_responses FOR UPDATE USING (public.calendar_is_admin()) WITH CHECK (public.calendar_is_admin());

CREATE OR REPLACE FUNCTION public.respond_to_program_session(p_session_id uuid, p_user_id uuid, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_session public.daily_program_sessions%ROWTYPE; v_join_count integer; v_status text; v_promote_user uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_user_id AND (id=auth.uid() OR auth_user_id=auth.uid())) THEN
        RAISE EXCEPTION '신청자 정보를 확인할 수 없습니다.' USING ERRCODE='42501';
    END IF;
    SELECT * INTO v_session FROM public.daily_program_sessions WHERE id=p_session_id FOR UPDATE;
    IF NOT FOUND OR v_session.session_date <> (now() AT TIME ZONE 'Asia/Seoul')::date THEN
        RAISE EXCEPTION '오늘의 프로그램만 신청할 수 있습니다.';
    END IF;
    IF p_action='CANCEL' THEN
        UPDATE public.daily_program_session_responses SET status='CANCELLED',cancelled_at=now() WHERE session_id=p_session_id AND user_id=p_user_id;
        SELECT count(*) INTO v_join_count FROM public.daily_program_session_responses WHERE session_id=p_session_id AND status='JOIN';
        IF v_session.capacity > 0 AND v_join_count < v_session.capacity THEN
            SELECT user_id INTO v_promote_user FROM public.daily_program_session_responses
            WHERE session_id=p_session_id AND status='WAITLIST' ORDER BY created_at LIMIT 1 FOR UPDATE;
            IF v_promote_user IS NOT NULL THEN
                UPDATE public.daily_program_session_responses SET status='JOIN',cancelled_at=NULL
                WHERE session_id=p_session_id AND user_id=v_promote_user;
            END IF;
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
GRANT SELECT ON public.daily_program_sessions TO anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.daily_program_session_responses TO authenticated;
GRANT INSERT,UPDATE ON public.daily_program_sessions TO authenticated;
