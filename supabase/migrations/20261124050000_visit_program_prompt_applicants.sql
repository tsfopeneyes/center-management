ALTER TABLE public.visit_program_prompts
    ADD COLUMN program_id bigint REFERENCES public.notices(id) ON DELETE SET NULL,
    ADD COLUMN show_to_applicants boolean NOT NULL DEFAULT true;

-- If a program is removed, the foreign key clears its ID. The client then
-- suppresses an exclusion-enabled prompt until staff select a new program.
