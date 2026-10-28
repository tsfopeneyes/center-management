-- Remove only the two out-of-scope questions. Preserve history and any later
-- operator edits by cloning the current version when it has changed.
BEGIN;
DO $restore$
DECLARE item record; restored uuid; definition jsonb;
BEGIN
  FOR item IN SELECT l.id,l.form_id,l.version_id,r.previous_version_id,r.measurement_version_id,v.definition
    FROM center_integration.retention_survey_recovery r JOIN public.survey_links l ON l.id=r.link_id
    JOIN public.survey_versions v ON v.id=l.version_id FOR UPDATE OF l
  LOOP
    IF item.version_id=item.measurement_version_id THEN
      UPDATE public.survey_links SET version_id=item.previous_version_id WHERE id=item.id;
    ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(item.definition->'questions') q
      WHERE q->>'id' IN ('center_visit_purpose_v1','center_teacher_contact_v1')) THEN
      definition := jsonb_set(item.definition-'retention_measurement_version','{questions}',
        (SELECT jsonb_agg(q ORDER BY position) FROM jsonb_array_elements(item.definition->'questions') WITH ORDINALITY AS entry(q,position)
         WHERE q->>'id' NOT IN ('center_visit_purpose_v1','center_teacher_contact_v1')));
      INSERT INTO public.survey_versions(form_id,definition) VALUES(item.form_id,definition) RETURNING id INTO restored;
      UPDATE public.survey_links SET version_id=restored WHERE id=item.id;
    END IF;
  END LOOP;
END $restore$;
COMMIT;
