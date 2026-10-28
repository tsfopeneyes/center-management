-- Add optional structured evidence to current HAIFN entry surveys. Preserve
-- immutable historical versions/answers and retain exact link recovery data.
BEGIN;
CREATE TABLE center_integration.retention_survey_recovery (
  link_id uuid PRIMARY KEY, previous_version_id uuid NOT NULL,
  measurement_version_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON center_integration.retention_survey_recovery FROM PUBLIC,anon,authenticated;

DO $migration$
DECLARE item record; new_version uuid; questions jsonb;
BEGIN
  questions := '[
    {"id":"center_visit_purpose_v1","type":"choice","title":"오늘은 어떤 이유로 센터에 왔나요?","required":false,"options":["자유롭게 쉬거나 놀려고","프로그램에 참여하려고","다른 이유","잘 모르겠어요"]},
    {"id":"center_teacher_contact_v1","type":"choice","title":"이번 방문 전에 선생님이 와 달라고 연락했나요?","required":false,"options":["아니요","네","잘 모르겠어요"]}
  ]'::jsonb;
  FOR item IN SELECT l.id,l.form_id,l.version_id,v.definition FROM public.survey_links l
    JOIN public.survey_versions v ON v.id=l.version_id
    WHERE l.enabled AND l.event='CHECKIN' AND l.center_code='HAIFN' AND l.frequency='EVERY_VISIT'
    FOR UPDATE OF l
  LOOP
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(item.definition->'questions') q
      WHERE q->>'id' IN ('center_visit_purpose_v1','center_teacher_contact_v1')) THEN
      RAISE EXCEPTION 'Retention question identifiers already exist; inspect instead of overwriting';
    END IF;
    INSERT INTO public.survey_versions(form_id,definition)
    VALUES(item.form_id,jsonb_set(item.definition,'{questions}',(item.definition->'questions')||questions)
      ||jsonb_build_object('retention_measurement_version',1)) RETURNING id INTO new_version;
    INSERT INTO center_integration.retention_survey_recovery(link_id,previous_version_id,measurement_version_id)
    VALUES(item.id,item.version_id,new_version);
    UPDATE public.survey_links SET version_id=new_version WHERE id=item.id AND version_id=item.version_id;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM center_integration.retention_survey_recovery) THEN
    RAISE EXCEPTION 'No active every-visit HAIFN check-in survey found';
  END IF;
END $migration$;

CREATE VIEW center_integration.analysis_visit_initiative WITH (security_barrier=true) AS
SELECT e.id::text AS id,l.user_id::text AS user_id,l.created_at AS visited_at,
  CASE e.answers->>'center_visit_purpose_v1'
    WHEN '자유롭게 쉬거나 놀려고' THEN 'free_use'
    WHEN '프로그램에 참여하려고' THEN 'program'
    WHEN '다른 이유' THEN 'other' ELSE 'unknown' END AS purpose,
  CASE e.answers->>'center_teacher_contact_v1'
    WHEN '아니요' THEN 'no' WHEN '네' THEN 'yes' ELSE 'unknown' END AS teacher_contact
FROM public.survey_entries e JOIN public.survey_links sl ON sl.id=e.link_id
JOIN public.logs l ON l.id::text=e.visit_id AND l.user_id=e.user_id AND l.type='CHECKIN'
WHERE sl.event='CHECKIN' AND sl.center_code='HAIFN' AND NOT e.aggregation_excluded
  AND e.snapshot->>'retention_measurement_version'='1';
ALTER VIEW center_integration.analysis_visit_initiative OWNER TO postgres;
REVOKE ALL ON center_integration.analysis_visit_initiative FROM PUBLIC,anon,authenticated;
GRANT SELECT ON center_integration.analysis_visit_initiative TO center_integration_reader;
COMMIT;
