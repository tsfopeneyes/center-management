BEGIN;

CREATE TABLE public.haifn_christmas_settings (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    mode text NOT NULL CHECK (mode IN ('closed', 'live', 'review'))
);

INSERT INTO public.haifn_christmas_settings (mode) VALUES ('closed');

CREATE TABLE public.haifn_christmas_drawings (
    id uuid PRIMARY KEY,
    image text NOT NULL CHECK (
        length(image) BETWEEN 70 AND 400000
        AND image ~ '^data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAeAAAAHg[A-Za-z0-9+/]+={0,2}$'
    ),
    status text NOT NULL CHECK (status IN ('published', 'pending', 'hidden')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX haifn_christmas_drawings_created_idx
    ON public.haifn_christmas_drawings (created_at, id);

ALTER TABLE public.haifn_christmas_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haifn_christmas_drawings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.haifn_christmas_settings, public.haifn_christmas_drawings
    FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (singleton, mode) ON public.haifn_christmas_settings TO anon, authenticated;
GRANT UPDATE (mode) ON public.haifn_christmas_settings TO authenticated;
GRANT SELECT (id, image, status, created_at), INSERT (id, image)
    ON public.haifn_christmas_drawings TO anon, authenticated;
GRANT UPDATE (status) ON public.haifn_christmas_drawings TO authenticated;

CREATE POLICY christmas_read_mode ON public.haifn_christmas_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY christmas_staff_mode ON public.haifn_christmas_settings FOR UPDATE TO authenticated
    USING ((SELECT public.is_current_staff())) WITH CHECK ((SELECT public.is_current_staff()));

CREATE POLICY christmas_read_published ON public.haifn_christmas_drawings FOR SELECT TO anon, authenticated
    USING (status = 'published');
CREATE POLICY christmas_staff_read ON public.haifn_christmas_drawings FOR SELECT TO authenticated
    USING ((SELECT public.is_current_staff()));
CREATE POLICY christmas_submit ON public.haifn_christmas_drawings FOR INSERT TO anon, authenticated
    WITH CHECK (status IN ('published', 'pending'));
CREATE POLICY christmas_staff_status ON public.haifn_christmas_drawings FOR UPDATE TO authenticated
    USING ((SELECT public.is_current_staff())) WITH CHECK ((SELECT public.is_current_staff()));

CREATE FUNCTION public.haifn_christmas_set_submission_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
    current_mode text;
BEGIN
    SELECT mode INTO current_mode FROM public.haifn_christmas_settings WHERE singleton FOR SHARE;
    CASE current_mode
        WHEN 'live' THEN NEW.status := 'published';
        WHEN 'review' THEN NEW.status := 'pending';
        ELSE RAISE EXCEPTION 'christmas_submissions_closed' USING ERRCODE = '23514';
    END CASE;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.haifn_christmas_set_submission_status() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER christmas_set_submission_status BEFORE INSERT ON public.haifn_christmas_drawings
    FOR EACH ROW EXECUTE FUNCTION public.haifn_christmas_set_submission_status();

COMMIT;
