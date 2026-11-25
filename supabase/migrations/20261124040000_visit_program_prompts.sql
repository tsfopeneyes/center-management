CREATE TABLE public.visit_program_prompts (
    center_code text PRIMARY KEY CHECK (center_code IN ('HAIFN', 'ENOUGH_PLACE')),
    title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
    description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
    url text NOT NULL CHECK (
        char_length(url) <= 2000 AND
        url ~* '^https?://[^/?#@[:space:][:cntrl:]]+([/?#].*)?$' AND
        url !~ '[[:space:][:cntrl:]]' AND strpos(url, chr(92)) = 0
    ),
    show_at text NOT NULL CHECK (show_at IN ('CHECKIN', 'CHECKOUT', 'BOTH')),
    enabled boolean NOT NULL DEFAULT false
);

REVOKE ALL ON public.visit_program_prompts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.visit_program_prompts TO anon, authenticated;
GRANT INSERT, UPDATE ON public.visit_program_prompts TO authenticated;

ALTER TABLE public.visit_program_prompts ENABLE ROW LEVEL SECURITY;

-- Published content is public because mobile guests can check in without signing in.
CREATE POLICY visit_program_prompts_active ON public.visit_program_prompts
    FOR SELECT TO anon, authenticated USING (enabled);
CREATE POLICY visit_program_prompts_staff_read ON public.visit_program_prompts
    FOR SELECT TO authenticated USING ((SELECT public.is_current_staff()));
CREATE POLICY visit_program_prompts_staff_insert ON public.visit_program_prompts
    FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_current_staff()));
CREATE POLICY visit_program_prompts_staff_update ON public.visit_program_prompts
    FOR UPDATE TO authenticated USING ((SELECT public.is_current_staff()))
    WITH CHECK ((SELECT public.is_current_staff()));
