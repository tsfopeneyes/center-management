-- Run through the existing notice DELETE boundary, after its RLS checks.
-- Keep immutable question versions and shared templates; remove program data atomically.
BEGIN;
CREATE FUNCTION public.cleanup_deleted_notice_surveys()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  DELETE FROM public.survey_entries e
   WHERE e.notice_id=OLD.id OR e.link_id IN (
     SELECT l.id FROM public.survey_links l WHERE l.notice_id=OLD.id
   );
  DELETE FROM public.survey_links WHERE notice_id=OLD.id;

  -- Published definitions are immutable. Retire an unused program-owned form
  -- instead of weakening that protection or deleting a reusable question source.
  UPDATE public.survey_forms f SET owner_notice_id=NULL,
    archived=CASE WHEN f.kind='PROGRAM'
      AND NOT EXISTS (SELECT 1 FROM public.survey_links l WHERE l.form_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM public.survey_entries e WHERE e.form_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM public.survey_forms child WHERE child.source_template_id=f.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.notices n JOIN public.survey_versions v
          ON v.id::text=n.guest_properties->>'survey_version_id'
         WHERE n.id<>OLD.id AND v.form_id=f.id
      ) THEN true ELSE f.archived END
   WHERE f.owner_notice_id=OLD.id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_deleted_notice_surveys() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cleanup_surveys_before_notice_delete BEFORE DELETE ON public.notices
 FOR EACH ROW EXECUTE FUNCTION public.cleanup_deleted_notice_surveys();
COMMIT;
