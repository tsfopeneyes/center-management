-- Keep program-owned surveys separate from reusable survey templates.
BEGIN;

ALTER TABLE public.survey_forms
  ADD COLUMN kind text NOT NULL DEFAULT 'REUSABLE'
    CHECK (kind IN ('REUSABLE', 'PROGRAM')),
  ADD COLUMN owner_notice_id bigint REFERENCES public.notices(id);

UPDATE public.survey_forms form
SET kind = 'PROGRAM', owner_notice_id = program_link.notice_id
FROM public.survey_links program_link
WHERE program_link.form_id = form.id
  AND program_link.event = 'PROGRAM'
  AND program_link.enabled
  AND EXISTS (
    SELECT 1
    FROM public.survey_versions version
    WHERE version.form_id = form.id
      AND version.definition->>'description' = '프로그램 피드백 설문'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(version.definition->'questions') question
        WHERE question->>'id' NOT LIKE 'program-question-%'
      )
  );

CREATE UNIQUE INDEX survey_one_owned_form_per_program
  ON public.survey_forms(owner_notice_id)
  WHERE kind = 'PROGRAM';

COMMIT;
