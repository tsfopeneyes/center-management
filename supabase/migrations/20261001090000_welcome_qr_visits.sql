-- Additive only. No changes to existing tables or raw logs.
BEGIN;
CREATE TABLE public.welcome_qr_visits (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    browser_token uuid NOT NULL,
    visit_day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Seoul')::date,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (visit_day, browser_token)
);
ALTER TABLE public.welcome_qr_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.welcome_qr_visits FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.welcome_qr_visits_id_seq FROM anon, authenticated;
GRANT INSERT (browser_token) ON public.welcome_qr_visits TO anon, authenticated;
GRANT USAGE ON SEQUENCE public.welcome_qr_visits_id_seq TO anon, authenticated;
GRANT SELECT ON public.welcome_qr_visits TO authenticated;
CREATE POLICY welcome_qr_insert ON public.welcome_qr_visits FOR INSERT TO anon, authenticated
WITH CHECK (NOT public.calendar_is_admin() AND visit_day = (now() AT TIME ZONE 'Asia/Seoul')::date);
CREATE POLICY welcome_qr_staff_read ON public.welcome_qr_visits FOR SELECT TO authenticated
USING (public.calendar_is_admin());
COMMIT;
