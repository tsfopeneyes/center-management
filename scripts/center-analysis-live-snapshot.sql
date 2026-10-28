-- Read-only preflight fixture for scripts/test-center-analysis-live.mjs.
-- It contains no names, contact information, text answers, real identifiers,
-- or stable hashes.  Every identifier is replaced with a query-local ordinal.
WITH
params AS (
  SELECT (current_date - 190)::date AS start_day,
         current_date::date AS end_exclusive,
         ((current_date - 190)::timestamp AT TIME ZONE 'Asia/Seoul') AS start_at,
         (current_date::timestamp AT TIME ZONE 'Asia/Seoul') AS end_at,
         clock_timestamp() AS as_of
),
relevant_logs AS (
  SELECT l.id, l.user_id, l.location_id, l.type, l.created_at
    FROM public.logs l
    CROSS JOIN params p
   WHERE l.created_at >= p.start_at AND l.created_at < p.end_at AND l.created_at <= p.as_of
),
candidate_programs AS (
  SELECT n.id, n.category, n.program_date, n.created_at, n.program_status, n.is_recruiting, n.guest_properties
    FROM public.notices n
    CROSS JOIN params p
   WHERE n.category = 'PROGRAM'
     AND n.program_status IS DISTINCT FROM 'CANCELLED'
     AND (
       (n.program_date >= p.start_at AND n.program_date < p.end_at)
       OR EXISTS (
         SELECT 1
           FROM public.daily_program_sessions ps
          WHERE ps.notice_id = n.id AND ps.session_date >= p.start_day AND ps.session_date < p.end_exclusive
       )
       OR EXISTS (
         SELECT 1
           FROM public.open_program_attendance oa
          WHERE oa.notice_id = n.id AND oa.attendance_date >= p.start_day AND oa.attendance_date < p.end_exclusive
       )
     )
),
relevant_sessions AS (
  SELECT ps.id, ps.notice_id, ps.session_date, ps.status, ps.voided_at
    FROM public.daily_program_sessions ps
    JOIN candidate_programs n ON n.id = ps.notice_id
    CROSS JOIN params p
   WHERE ps.session_date >= p.start_day AND ps.session_date < p.end_exclusive
),
all_migrated_programs AS (
  SELECT DISTINCT ps.notice_id
    FROM public.daily_program_sessions ps
    JOIN candidate_programs n ON n.id = ps.notice_id
),
relevant_responses AS (
  SELECT r.notice_id, r.user_id, r.status, r.is_attended, r.is_staff
    FROM public.notice_responses r
    JOIN candidate_programs n ON n.id = r.notice_id
),
relevant_session_responses AS (
  SELECT sr.session_id, sr.user_id, sr.status, sr.is_attended
    FROM public.daily_program_session_responses sr
    JOIN relevant_sessions ps ON ps.id = sr.session_id
),
relevant_open_attendance AS (
  SELECT oa.notice_id, oa.user_id, oa.attendance_date
    FROM public.open_program_attendance oa
    JOIN candidate_programs n ON n.id = oa.notice_id
    CROSS JOIN params p
   WHERE oa.attendance_date >= p.start_day AND oa.attendance_date < p.end_exclusive
),
scoped_people AS (
  SELECT user_id AS id FROM relevant_logs WHERE user_id IS NOT NULL
  UNION
  SELECT user_id FROM relevant_responses WHERE user_id IS NOT NULL
  UNION
  SELECT user_id FROM relevant_session_responses WHERE user_id IS NOT NULL
  UNION
  SELECT user_id FROM relevant_open_attendance WHERE user_id IS NOT NULL
),
person_map AS (
  SELECT id, ('person-' || row_number() OVER (ORDER BY id))::text AS ref
    FROM scoped_people
),
scoped_locations AS (
  SELECT DISTINCT location_id AS id FROM relevant_logs WHERE location_id IS NOT NULL
),
location_map AS (
  SELECT id, ('location-' || row_number() OVER (ORDER BY id))::text AS ref
    FROM scoped_locations
),
program_map AS (
  SELECT id, ('program-' || row_number() OVER (ORDER BY id))::text AS ref
    FROM candidate_programs
),
session_map AS (
  SELECT id, ('session-' || row_number() OVER (ORDER BY id))::text AS ref
    FROM relevant_sessions
),
relevant_satisfaction AS (
  SELECT ('entry:' || e.id::text) AS source_key,
         e.notice_id,
         (e.answers ->> (question.value ->> 'id'))::numeric::integer AS value,
         e.created_at AS submitted_at
    FROM public.survey_entries e
    JOIN candidate_programs n ON n.id = e.notice_id
    JOIN public.survey_versions v ON v.id = e.version_id
    CROSS JOIN LATERAL jsonb_array_elements(v.definition -> 'questions') AS question(value)
    CROSS JOIN params p
   WHERE e.aggregation_excluded IS NOT TRUE
     AND e.created_at >= p.start_at AND e.created_at < p.end_at
     AND question.value ->> 'metric' = 'satisfaction'
     AND question.value ->> 'type' = 'star'
     AND coalesce(e.answers ->> (question.value ->> 'id'), '') ~ '^[1-5](\.0+)?$'
  UNION ALL
  SELECT ('feedback:' || f.id::text) AS source_key,
         f.notice_id,
         f.q3_satisfaction AS value,
         f.created_at AS submitted_at
    FROM public.program_feedback f
    JOIN candidate_programs n ON n.id = f.notice_id
    CROSS JOIN params p
   WHERE f.aggregation_excluded IS NOT TRUE
     AND f.created_at >= p.start_at AND f.created_at < p.end_at
     AND f.q3_satisfaction BETWEEN 1 AND 5
     AND (jsonb_typeof(n.guest_properties -> 'custom_feedback_config' -> 'questions') IS DISTINCT FROM 'array'
          OR jsonb_array_length(n.guest_properties -> 'custom_feedback_config' -> 'questions') = 0)
),
satisfaction_map AS (
  SELECT sf.*, ('satisfaction-' || row_number() OVER (ORDER BY sf.submitted_at, sf.source_key))::text AS ref
    FROM relevant_satisfaction sf
),
log_map AS (
  SELECT l.*, ('log-' || lpad((row_number() OVER (ORDER BY l.created_at, l.id::text))::text, 10, '0'))::text AS ref
    FROM relevant_logs l
),
relevant_rentals AS (
  SELECT rb.id, rb.booking_date, rb.status
    FROM public.rental_bookings rb
    CROSS JOIN params p
   WHERE rb.booking_date >= p.start_day AND rb.booking_date < p.end_exclusive
),
relevant_store_orders AS (
  SELECT so.id, so.created_at, so.status
    FROM public.store_orders so
    CROSS JOIN params p
   WHERE so.created_at >= p.start_at AND so.created_at < p.end_at
),
relevant_surveys AS (
  SELECT cs.id, cs.created_at, cs.survey_type
    FROM public.checkin_surveys cs
    CROSS JOIN params p
   WHERE cs.aggregation_excluded IS NOT TRUE
     AND cs.created_at >= p.start_at AND cs.created_at < p.end_at
),
rental_map AS (
  SELECT rb.*, ('rental-' || row_number() OVER (ORDER BY rb.id))::text AS ref
    FROM relevant_rentals rb
),
store_map AS (
  SELECT so.*, ('store-' || row_number() OVER (ORDER BY so.id))::text AS ref
    FROM relevant_store_orders so
),
survey_map AS (
  SELECT cs.*, ('survey-' || row_number() OVER (ORDER BY cs.id))::text AS ref
    FROM relevant_surveys cs
)
SELECT jsonb_build_object(
  'period', jsonb_build_object('start', p.start_day::text, 'end_exclusive', p.end_exclusive::text),
  'snapshot', jsonb_build_object(
    'complete', true,
    'approved_programs', COALESCE((SELECT jsonb_agg(jsonb_build_object('program_ref',pm.ref,'title',c.title)) FROM center_integration.program_catalog c JOIN program_map pm ON pm.id::text=c.program_ref WHERE c.published), '[]'::jsonb),
    'operating_context', COALESCE((SELECT jsonb_agg(jsonb_build_object('domain',domain,'start',start_day::text,'end_exclusive',end_exclusive::text,'activity_status',activity_status,'evidence',evidence)) FROM center_integration.operating_context), '[]'::jsonb),
    'as_of', to_char(p.as_of AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'datasets', jsonb_build_object(
      'users', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', pm.ref, 'user_group', u.user_group) ORDER BY pm.ref)
          FROM public.users u
          JOIN person_map pm ON pm.id = u.id
      ), '[]'::jsonb),
      'staff', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', pm.ref, 'role', s.role) ORDER BY pm.ref)
          FROM public.staff_directory s
          JOIN person_map pm ON pm.id = s.id
      ), '[]'::jsonb),
      'locations', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', lm.ref) ORDER BY lm.ref)
          FROM public.locations l
          JOIN location_map lm ON lm.id = l.id
      ), '[]'::jsonb),
      'logs', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', l.ref,
          'user_id', pm.ref, 'type', l.type, 'location_id', lm.ref, 'created_at', l.created_at::text
        ) ORDER BY l.created_at, l.id)
          FROM log_map l
          JOIN person_map pm ON pm.id = l.user_id
          LEFT JOIN location_map lm ON lm.id = l.location_id
      ), '[]'::jsonb),
      'notices', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', pm.ref, 'category', n.category, 'program_date', n.program_date::text,
          'created_at', n.created_at::text, 'program_status', n.program_status, 'is_recruiting', n.is_recruiting
        ) ORDER BY pm.ref)
          FROM candidate_programs n
          JOIN program_map pm ON pm.id = n.id
      ), '[]'::jsonb),
      'responses', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'notice_id', npm.ref, 'user_id', upm.ref, 'status', r.status,
          'is_attended', r.is_attended, 'is_staff', r.is_staff
        ) ORDER BY npm.ref, upm.ref)
          FROM relevant_responses r
          JOIN program_map npm ON npm.id = r.notice_id
          JOIN person_map upm ON upm.id = r.user_id
      ), '[]'::jsonb),
      'sessions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', sm.ref, 'notice_id', npm.ref, 'session_date', ps.session_date::text,
          'status', ps.status, 'voided_at', ps.voided_at::text
        ) ORDER BY sm.ref)
          FROM relevant_sessions ps
          JOIN session_map sm ON sm.id = ps.id
          JOIN program_map npm ON npm.id = ps.notice_id
      ), '[]'::jsonb),
      'sessionResponses', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'session_id', sm.ref, 'user_id', pm.ref, 'status', sr.status, 'is_attended', sr.is_attended
        ) ORDER BY sm.ref, pm.ref)
          FROM relevant_session_responses sr
          JOIN session_map sm ON sm.id = sr.session_id
          JOIN person_map pm ON pm.id = sr.user_id
      ), '[]'::jsonb),
      'openAttendance', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'notice_id', npm.ref, 'user_id', upm.ref, 'attendance_date', oa.attendance_date::text
        ) ORDER BY npm.ref, upm.ref, oa.attendance_date)
          FROM relevant_open_attendance oa
          JOIN program_map npm ON npm.id = oa.notice_id
          JOIN person_map upm ON upm.id = oa.user_id
      ), '[]'::jsonb),
      'migratedProgramRefs', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('notice_id', npm.ref) ORDER BY npm.ref)
          FROM all_migrated_programs mp
          JOIN program_map npm ON npm.id = mp.notice_id
      ), '[]'::jsonb),
      'satisfactionResponses', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', sm.ref, 'program_ref', npm.ref, 'value', sm.value, 'submitted_at', sm.submitted_at::text
        ) ORDER BY sm.ref)
          FROM satisfaction_map sm
          JOIN program_map npm ON npm.id = sm.notice_id
      ), '[]'::jsonb),
      'rentalBookings', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', rb.ref,
          'booking_date', rb.booking_date::text, 'status', rb.status
        ) ORDER BY rb.id)
          FROM rental_map rb
      ), '[]'::jsonb),
      'storeOrders', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', so.ref,
          'created_at', so.created_at::text, 'status', so.status
        ) ORDER BY so.id)
          FROM store_map so
      ), '[]'::jsonb),
      'checkinSurveys', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', cs.ref,
          'created_at', cs.created_at::text, 'survey_type', cs.survey_type
        ) ORDER BY cs.id)
          FROM survey_map cs
      ), '[]'::jsonb)
    )
  )
) AS live
FROM params p;
