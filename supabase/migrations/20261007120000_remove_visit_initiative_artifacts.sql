-- User explicitly requested removal of these newly created artifacts.
-- Preflight backup retained separately; no original versions or answers removed.
BEGIN;
LOCK TABLE public.survey_versions, public.survey_links, public.survey_entries IN SHARE ROW EXCLUSIVE MODE;
DO $guard$
BEGIN
 IF EXISTS(SELECT 1 FROM public.survey_entries e JOIN center_integration.retention_survey_recovery r ON r.measurement_version_id=e.version_id)
 OR EXISTS(SELECT 1 FROM public.survey_links l JOIN center_integration.retention_survey_recovery r ON r.measurement_version_id=l.version_id) THEN
   RAISE EXCEPTION 'New survey version is referenced; preserve it and inspect';
 END IF;
 IF (SELECT count(*) FROM center_integration.retention_survey_recovery) <> 1 THEN
   RAISE EXCEPTION 'Unexpected cleanup scope';
 END IF;
END $guard$;
DELETE FROM public.survey_versions v USING center_integration.retention_survey_recovery r
WHERE v.id=r.measurement_version_id AND v.definition->>'retention_measurement_version'='1';
DROP VIEW center_integration.analysis_visit_initiative;
DROP TABLE center_integration.retention_survey_recovery;
COMMIT;
