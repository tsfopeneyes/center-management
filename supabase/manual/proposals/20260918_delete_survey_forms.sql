-- REVIEW REQUIRED: apply only after approval and a production impact check.
-- Scope: one selected unified survey and its exact linked responses. Visit logs
-- and unattributed historical rows are intentionally outside this operation.
BEGIN;

-- Published versions remain immutable, but can be removed with their form.
DROP TRIGGER IF EXISTS guard_survey_version ON public.survey_versions;
CREATE TRIGGER guard_survey_version BEFORE INSERT OR UPDATE
  ON public.survey_versions FOR EACH ROW EXECUTE FUNCTION public.guard_survey_version();

CREATE POLICY survey_forms_delete ON public.survey_forms FOR DELETE TO authenticated
  USING (public.is_current_staff() AND kind <> 'PROGRAM');
CREATE POLICY survey_versions_delete ON public.survey_versions FOR DELETE TO authenticated
  USING (public.is_current_staff() AND EXISTS (
    SELECT 1 FROM public.survey_forms f WHERE f.id = form_id AND f.kind <> 'PROGRAM'));
CREATE POLICY survey_links_delete ON public.survey_links FOR DELETE TO authenticated
  USING (public.is_current_staff() AND EXISTS (
    SELECT 1 FROM public.survey_forms f WHERE f.id = form_id AND f.kind <> 'PROGRAM'));
CREATE POLICY survey_entries_delete ON public.survey_entries FOR DELETE TO authenticated
  USING (public.is_current_staff() AND EXISTS (
    SELECT 1 FROM public.survey_forms f WHERE f.id = form_id AND f.kind <> 'PROGRAM'));
GRANT DELETE ON public.survey_forms, public.survey_versions,
  public.survey_links, public.survey_entries TO authenticated;

CREATE FUNCTION public.delete_survey_form(p_form_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_kind text;
  legacy_source jsonb;
BEGIN
  IF NOT public.is_current_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT kind INTO target_kind FROM public.survey_forms WHERE id = p_form_id FOR UPDATE;
  IF target_kind IS NULL THEN
    RAISE EXCEPTION 'Survey not found';
  END IF;
  IF target_kind = 'PROGRAM' THEN
    RAISE EXCEPTION 'Program surveys must be managed with their program';
  END IF;
  SELECT definition->'legacySource' INTO legacy_source
  FROM public.survey_versions WHERE form_id = p_form_id
  ORDER BY created_at ASC LIMIT 1;

  DELETE FROM public.survey_entries WHERE form_id = p_form_id;
  DELETE FROM public.survey_links WHERE form_id = p_form_id;
  DELETE FROM public.survey_versions WHERE form_id = p_form_id;
  DELETE FROM public.survey_forms WHERE id = p_form_id;

  -- Only rows explicitly tied to the old survey ID can be attributed safely.
  IF legacy_source->>'table' = 'surveys' AND legacy_source->>'id' = p_form_id::text THEN
    DELETE FROM public.checkin_surveys WHERE survey_id = p_form_id;
    DELETE FROM public.surveys WHERE id = p_form_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.delete_survey_form(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_survey_form(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
