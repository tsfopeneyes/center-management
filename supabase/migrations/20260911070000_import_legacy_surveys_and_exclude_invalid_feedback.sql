-- Preserve existing visit surveys in the unified catalog and repair the one
-- feedback row attached to a program that never enabled feedback collection.
BEGIN;

ALTER TABLE public.program_feedback
  ADD COLUMN IF NOT EXISTS aggregation_excluded boolean NOT NULL DEFAULT false;

INSERT INTO public.survey_forms (id, title, archived, created_at)
SELECT s.id, s.title, s.status IS DISTINCT FROM 'ACTIVE', s.created_at
FROM public.surveys s
WHERE NOT EXISTS (SELECT 1 FROM public.survey_forms f WHERE f.id = s.id);

INSERT INTO public.survey_versions (form_id, definition)
SELECT s.id,
       jsonb_build_object(
         'title', s.title,
         'description', coalesce(s.config->>'description', ''),
         'legacySource', jsonb_build_object('table', 'surveys', 'id', s.id),
         'questions',
           jsonb_build_array(
             jsonb_build_object(
               'id', 'legacy-main-' || s.id::text,
               'title', coalesce(nullif(s.config->>'question', ''), nullif(s.config->>'qaQuestion', ''), s.title),
               'type', CASE WHEN coalesce(s.config->>'mode', 'SURVEY') IN ('QUESTION_QA','FEEDBACK_QA','CHAT_SHOUTOUT') THEN 'text' ELSE 'multiple' END,
               'required', false,
               'options', CASE
                 WHEN coalesce(s.config->>'mode', 'SURVEY') IN ('QUESTION_QA','FEEDBACK_QA','CHAT_SHOUTOUT') THEN '[]'::jsonb
                 ELSE coalesce((SELECT jsonb_agg(option->>'label' ORDER BY ordinal)
                                FROM jsonb_array_elements(coalesce(s.config->'options','[]'::jsonb)) WITH ORDINALITY choices(option, ordinal)
                                WHERE nullif(trim(option->>'label'), '') IS NOT NULL), '[]'::jsonb)
               END
             )
           ) || CASE WHEN coalesce((s.config->'additionalComment'->>'enabled')::boolean, false)
             THEN jsonb_build_array(jsonb_build_object(
               'id', 'legacy-comment-' || s.id::text,
               'title', coalesce(nullif(s.config->'additionalComment'->>'label', ''), '추가 의견'),
               'type', 'text',
               'required', coalesce((s.config->'additionalComment'->>'required')::boolean, false),
               'options', '[]'::jsonb
             )) ELSE '[]'::jsonb END
       )
FROM public.surveys s
WHERE NOT EXISTS (SELECT 1 FROM public.survey_versions v WHERE v.form_id = s.id);

WITH system_configs AS (
  SELECT CASE n.title WHEN 'CHECKIN_SURVEY_CONFIG' THEN 'CHECKIN' ELSE 'CHECKOUT' END AS event,
         n.content::jsonb AS config
  FROM public.notices n
  WHERE n.category = 'SYSTEM'
    AND n.title IN ('CHECKIN_SURVEY_CONFIG','CHECKOUT_SURVEY_CONFIG')
    AND n.content IS NOT NULL
), current_targets AS (
  SELECT (config->>'_surveyId')::uuid AS form_id,
         event,
         center.value AS center_code,
         coalesce(nullif(config->'exposure'->>'frequency',''), 'EVERY_VISIT') AS frequency,
         coalesce((config->'exposure'->>'priority')::integer, 999) AS priority,
         coalesce((config->'exposure'->>'isDefault')::boolean, false) AS is_default
  FROM system_configs
  CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(config->'exposure'->'centers','[]'::jsonb)) center(value)
  WHERE coalesce((config->'exposure'->>'enabled')::boolean, true)
    AND nullif(config->>'_surveyId','') IS NOT NULL
), versions AS (
  SELECT DISTINCT ON (v.form_id) v.form_id, v.id AS version_id
  FROM public.survey_versions v
  ORDER BY v.form_id, v.created_at DESC
)
INSERT INTO public.survey_links (form_id, version_id, event, center_code, frequency, priority, is_default)
SELECT target.form_id, versions.version_id, target.event, target.center_code,
       target.frequency, target.priority, target.is_default
FROM current_targets target
JOIN versions ON versions.form_id = target.form_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.survey_links link
  WHERE link.enabled AND link.event = target.event AND link.center_code = target.center_code
);

-- This is the only legacy feedback row whose program neither enabled feedback
-- nor required a review. Keep the raw response for audit, but exclude it from
-- aggregates and from the program feedback catalog.
UPDATE public.program_feedback feedback
SET aggregation_excluded = true
WHERE feedback.id = 'd6ce2b43-96ca-47d3-9253-7c7e5f01ab3b'::uuid
  AND feedback.notice_id = 83
  AND EXISTS (
    SELECT 1 FROM public.notices program
    WHERE program.id = feedback.notice_id
      AND program.is_review_required = false
      AND coalesce((program.guest_properties->>'enable_feedback')::boolean, false) = false
      AND jsonb_array_length(coalesce(program.guest_properties->'custom_feedback_config'->'questions','[]'::jsonb)) = 0
  );

COMMIT;
