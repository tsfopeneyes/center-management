-- Proposed only. Review and dry-run before applying to production.
-- Visitor access is exclusively through the haifn-chat Edge Function.
CREATE TABLE IF NOT EXISTS public.haifn_chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'DONE')),
    assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.haifn_chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.haifn_chat_sessions(id) ON DELETE RESTRICT,
    sender text NOT NULL CHECK (sender IN ('VISITOR', 'STAFF')),
    sender_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    CONSTRAINT haifn_chat_sender_identity CHECK ((sender = 'VISITOR' AND sender_id IS NULL) OR (sender = 'STAFF' AND sender_id IS NOT NULL)),
    body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 1000),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.haifn_chat_operators (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.haifn_chat_operator_notifications (
    message_id uuid NOT NULL REFERENCES public.haifn_chat_messages(id) ON DELETE RESTRICT,
    operator_id uuid NOT NULL REFERENCES public.haifn_chat_operators(user_id) ON DELETE RESTRICT,
    read_at timestamptz,
    PRIMARY KEY (message_id, operator_id)
);
CREATE INDEX IF NOT EXISTS haifn_chat_unread_operator_idx
    ON public.haifn_chat_operator_notifications (operator_id, message_id) WHERE read_at IS NULL;

-- Fail closed if the four named staff profiles cannot be identified exactly.
DO $$
DECLARE matched_count integer;
BEGIN
    SELECT count(*) INTO matched_count FROM public.users
    WHERE lower(btrim(name)) IN ('jin', 'zoe', 'sunny', 'zzang')
      AND user_group = 'STAFF' AND status <> 'withdrawn';
    IF matched_count <> 4 THEN
        RAISE EXCEPTION 'Expected exactly four active HAIFN operators, found %', matched_count;
    END IF;
    INSERT INTO public.haifn_chat_operators (user_id)
    SELECT id FROM public.users
    WHERE lower(btrim(name)) IN ('jin', 'zoe', 'sunny', 'zzang')
      AND user_group = 'STAFF' AND status <> 'withdrawn'
    ON CONFLICT DO NOTHING;
END $$;

CREATE INDEX IF NOT EXISTS haifn_chat_sessions_updated_idx ON public.haifn_chat_sessions (updated_at DESC);
CREATE INDEX IF NOT EXISTS haifn_chat_messages_session_created_idx ON public.haifn_chat_messages (session_id, created_at);

CREATE FUNCTION public.haifn_chat_update_session_from_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
    UPDATE public.haifn_chat_sessions
    SET updated_at = NEW.created_at,
        status = CASE WHEN NEW.sender = 'VISITOR' THEN 'OPEN' ELSE 'IN_PROGRESS' END,
        assigned_to = CASE WHEN NEW.sender = 'STAFF' THEN NEW.sender_id ELSE assigned_to END
    WHERE id = NEW.session_id;
    INSERT INTO public.haifn_chat_operator_notifications (message_id, operator_id)
    SELECT NEW.id, o.user_id FROM public.haifn_chat_operators o
    WHERE NEW.sender = 'VISITOR' OR o.user_id <> NEW.sender_id;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.haifn_chat_update_session_from_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER haifn_chat_message_touches_session
AFTER INSERT ON public.haifn_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.haifn_chat_update_session_from_message();

ALTER TABLE public.haifn_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haifn_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haifn_chat_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haifn_chat_operator_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.haifn_chat_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.haifn_chat_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.haifn_chat_operators FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.haifn_chat_operator_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id) ON public.haifn_chat_operators TO authenticated;
GRANT SELECT (id, status, assigned_to, created_at, updated_at),
      UPDATE (status, assigned_to, updated_at) ON public.haifn_chat_sessions TO authenticated;
GRANT SELECT (id, session_id, sender, sender_id, body, created_at),
      INSERT (session_id, sender, sender_id, body) ON public.haifn_chat_messages TO authenticated;
GRANT SELECT (message_id, operator_id, read_at), UPDATE (read_at)
    ON public.haifn_chat_operator_notifications TO authenticated;

CREATE POLICY haifn_chat_operator_self ON public.haifn_chat_operators
    FOR SELECT TO authenticated USING (public.is_current_staff());
CREATE POLICY haifn_chat_notification_read ON public.haifn_chat_operator_notifications
    FOR SELECT TO authenticated USING (operator_id = public.current_profile_id());
CREATE POLICY haifn_chat_notification_mark_read ON public.haifn_chat_operator_notifications
    FOR UPDATE TO authenticated USING (operator_id = public.current_profile_id())
    WITH CHECK (operator_id = public.current_profile_id());

CREATE POLICY haifn_chat_staff_sessions ON public.haifn_chat_sessions
    FOR SELECT TO authenticated USING (EXISTS (
        SELECT 1 FROM public.haifn_chat_operators o WHERE o.user_id = public.current_profile_id()
    ));
CREATE POLICY haifn_chat_staff_sessions_update ON public.haifn_chat_sessions
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.haifn_chat_operators o WHERE o.user_id = public.current_profile_id()))
    WITH CHECK (assigned_to IS NULL OR EXISTS (
        SELECT 1 FROM public.haifn_chat_operators o WHERE o.user_id = assigned_to
    ));
CREATE POLICY haifn_chat_staff_messages_read ON public.haifn_chat_messages
    FOR SELECT TO authenticated USING (EXISTS (
        SELECT 1 FROM public.haifn_chat_operators o WHERE o.user_id = public.current_profile_id()
    ));
CREATE POLICY haifn_chat_staff_messages_write ON public.haifn_chat_messages
    FOR INSERT TO authenticated WITH CHECK (sender = 'STAFF' AND sender_id = public.current_profile_id()
        AND EXISTS (SELECT 1 FROM public.haifn_chat_operators o WHERE o.user_id = public.current_profile_id()));
