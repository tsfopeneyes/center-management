-- Run only if this release must be rolled back. Retain all versions/answers.
-- Guard ensures later operator edits are never overwritten.
BEGIN;
UPDATE public.survey_links l SET version_id=r.previous_version_id
FROM center_integration.retention_survey_recovery r
WHERE l.id=r.link_id AND l.version_id=r.measurement_version_id;
COMMIT;
