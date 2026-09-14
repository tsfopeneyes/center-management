-- Separate reusable templates from live surveys and save each program's
-- copied/customized survey atomically.
BEGIN;

ALTER TABLE public.survey_forms DROP CONSTRAINT IF EXISTS survey_forms_kind_check;
UPDATE public.survey_forms SET kind = 'SURVEY' WHERE kind = 'REUSABLE';
ALTER TABLE public.survey_forms
  ADD CONSTRAINT survey_forms_kind_check
  CHECK (kind IN ('SURVEY', 'TEMPLATE', 'PROGRAM'));
ALTER TABLE public.survey_forms ALTER COLUMN kind SET DEFAULT 'SURVEY';
ALTER TABLE public.survey_forms
  ADD COLUMN IF NOT EXISTS source_template_id uuid
  REFERENCES public.survey_forms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS survey_forms_source_template
  ON public.survey_forms(source_template_id)
  WHERE source_template_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.save_program_survey(
  p_notice_id bigint,
  p_form_id uuid,
  p_template_id uuid,
  p_definition jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_form uuid;
  target_version uuid;
  target_link uuid;
BEGIN
  IF NOT public.is_current_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notices WHERE id = p_notice_id AND category = 'PROGRAM') THEN
    RAISE EXCEPTION 'Program not found';
  END IF;
  IF p_template_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.survey_forms WHERE id = p_template_id AND kind = 'TEMPLATE'
  ) THEN
    RAISE EXCEPTION 'Survey template not found';
  END IF;

  target_form := p_form_id;
  IF target_form IS NULL THEN
    SELECT id INTO target_form
    FROM public.survey_forms
    WHERE kind = 'PROGRAM' AND owner_notice_id = p_notice_id
    LIMIT 1;
  END IF;

  IF target_form IS NULL THEN
    INSERT INTO public.survey_forms(title, kind, owner_notice_id, source_template_id)
    VALUES(p_definition->>'title', 'PROGRAM', p_notice_id, p_template_id)
    RETURNING id INTO target_form;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.survey_forms
      WHERE id = target_form AND kind = 'PROGRAM' AND owner_notice_id = p_notice_id
    ) THEN
      RAISE EXCEPTION 'Program survey does not belong to this program';
    END IF;
    UPDATE public.survey_forms
    SET title = p_definition->>'title', source_template_id = p_template_id
    WHERE id = target_form;
  END IF;

  INSERT INTO public.survey_versions(form_id, definition)
  VALUES(target_form, p_definition)
  RETURNING id INTO target_version;

  UPDATE public.survey_links
  SET enabled = false
  WHERE notice_id = p_notice_id AND event = 'PROGRAM' AND enabled;

  SELECT id INTO target_link
  FROM public.survey_links
  WHERE notice_id = p_notice_id AND event = 'PROGRAM' AND form_id = target_form
  ORDER BY created_at DESC
  LIMIT 1;

  IF target_link IS NULL THEN
    INSERT INTO public.survey_links(
      form_id, version_id, event, notice_id, enabled,
      frequency, audience, timing
    ) VALUES(
      target_form, target_version, 'PROGRAM', p_notice_id, true,
      'ONCE', 'ATTENDED', 'AFTER_END'
    ) RETURNING id INTO target_link;
  ELSE
    UPDATE public.survey_links
    SET version_id = target_version,
        enabled = true,
        frequency = 'ONCE',
        audience = 'ATTENDED',
        timing = 'AFTER_END',
        opens_at = NULL,
        closes_at = NULL
    WHERE id = target_link;
  END IF;

  RETURN jsonb_build_object(
    'form_id', target_form,
    'version_id', target_version,
    'link_id', target_link
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_program_survey(bigint, uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_program_survey(bigint, uuid, uuid, jsonb) TO authenticated;

COMMIT;
