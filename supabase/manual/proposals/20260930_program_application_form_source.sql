-- REVIEW DRAFT. Apply only with the guarded runner after all legacy forms
-- have been validated and imported without changing historical responses.
ALTER TABLE public.notices
    ADD CONSTRAINT program_application_form_required
    CHECK (category IS DISTINCT FROM 'PROGRAM' OR application_form IS NOT NULL)
    NOT VALID;

ALTER TABLE public.notices
    VALIDATE CONSTRAINT program_application_form_required;
