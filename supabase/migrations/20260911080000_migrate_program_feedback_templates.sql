-- Convert each active legacy program feedback configuration into a reusable
-- survey template. Programs keep separate links, so responses remain scoped
-- to the program even when two programs share the same question set.
BEGIN;

CREATE TEMP TABLE program_feedback_template_map ON COMMIT DROP AS
WITH candidates AS (
  SELECT
    n.id AS notice_id,
    n.title AS program_title,
    n.guest_properties->'custom_feedback_config' AS config,
    md5((n.guest_properties->'custom_feedback_config'->'questions')::text) AS config_key
  FROM public.notices n
  WHERE n.category = 'PROGRAM'
    AND coalesce((n.guest_properties->>'enable_feedback')::boolean, false)
    AND nullif(n.guest_properties->>'survey_version_id', '') IS NULL
    AND jsonb_typeof(n.guest_properties->'custom_feedback_config'->'questions') = 'array'
    AND jsonb_array_length(n.guest_properties->'custom_feedback_config'->'questions') > 0
), grouped AS (
  SELECT DISTINCT ON (config_key)
    config_key,
    program_title,
    config,
    gen_random_uuid() AS form_id,
    gen_random_uuid() AS version_id
  FROM candidates
  ORDER BY config_key, notice_id
)
SELECT * FROM grouped;

INSERT INTO public.survey_forms(id, title)
SELECT
  form_id,
  coalesce(nullif(trim(config->>'title'), ''), program_title || ' 피드백')
FROM program_feedback_template_map;

INSERT INTO public.survey_versions(id, form_id, definition)
SELECT
  template.version_id,
  template.form_id,
  jsonb_build_object(
    'title', coalesce(nullif(trim(template.config->>'title'), ''), template.program_title || ' 피드백'),
    'description', '프로그램 피드백 설문',
    'questions', (
      SELECT jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', 'program-question-' || question.ordinality,
            'type', CASE
              WHEN question.value->>'type' IN ('short','text','choice','multiple','star') THEN question.value->>'type'
              ELSE 'text'
            END,
            'title', coalesce(nullif(trim(question.value->>'title'), ''), '질문 ' || question.ordinality),
            'required', coalesce((question.value->>'required')::boolean, true),
            'placeholder', nullif(question.value->>'placeholder', ''),
            'metric', CASE
              WHEN question.value->>'type' = 'star' AND question.value->>'title' LIKE '%만족%' THEN 'satisfaction'
              ELSE NULL
            END
          ) || CASE
            WHEN question.value->>'type' IN ('choice','multiple') THEN jsonb_build_object(
              'options', CASE
                WHEN jsonb_typeof(question.value->'options') = 'array' THEN (
                  SELECT jsonb_agg(option_label)
                  FROM (
                    SELECT trim(CASE WHEN jsonb_typeof(option_value) = 'string' THEN option_value #>> '{}' ELSE option_value->>'label' END) AS option_label
                    FROM jsonb_array_elements(question.value->'options') AS option_value
                  ) labels
                  WHERE option_label <> ''
                )
                ELSE (
                  SELECT jsonb_agg(trim(option_label))
                  FROM unnest(string_to_array(question.value->>'options', ',')) AS option_label
                  WHERE trim(option_label) <> ''
                )
              END
            )
            ELSE '{}'::jsonb
          END
        )
        ORDER BY question.ordinality
      )
      FROM jsonb_array_elements(template.config->'questions') WITH ORDINALITY AS question(value, ordinality)
    )
  )
FROM program_feedback_template_map template;

INSERT INTO public.survey_links(
  form_id, version_id, event, center_code, notice_id,
  enabled, frequency, priority, is_default, audience, timing
)
SELECT
  template.form_id,
  template.version_id,
  'PROGRAM',
  NULL,
  n.id,
  true,
  'ONCE',
  100,
  false,
  'ATTENDED',
  'AFTER_END'
FROM public.notices n
JOIN program_feedback_template_map template
  ON template.config_key = md5((n.guest_properties->'custom_feedback_config'->'questions')::text)
WHERE n.category = 'PROGRAM'
  AND coalesce((n.guest_properties->>'enable_feedback')::boolean, false)
  AND nullif(n.guest_properties->>'survey_version_id', '') IS NULL;

COMMIT;
