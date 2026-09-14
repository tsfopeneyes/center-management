-- Final one-time refresh immediately before the normalized application is
-- deployed. This captures records written by the previous application between
-- the foundation migration and the application cutover.

INSERT INTO public.offline_challenge_missions (
    challenge_id, legacy_key, title, description, location, verification_type, sort_order
)
SELECT n.id,
       COALESCE(NULLIF(m.value->>'id', ''), 'legacy-' || (m.ordinality - 1)::text),
       COALESCE(NULLIF(trim(m.value->>'title'), ''), '미션 ' || m.ordinality::text),
       COALESCE(m.value->>'description', ''), COALESCE(m.value->>'location', ''),
       CASE WHEN lower(COALESCE(m.value->>'verification_type', 'photo')) = 'text' THEN 'TEXT' ELSE 'PHOTO' END,
       (m.ordinality - 1)::integer
FROM public.notices n
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(n.challenge_missions, '[]'::jsonb))
    WITH ORDINALITY AS m(value, ordinality)
WHERE n.is_challenge AND n.challenge_format = 'OFFLINE'
ON CONFLICT (challenge_id, legacy_key) DO UPDATE SET
    title = EXCLUDED.title, description = EXCLUDED.description, location = EXCLUDED.location,
    verification_type = EXCLUDED.verification_type, sort_order = EXCLUDED.sort_order,
    is_active = true, updated_at = now();

INSERT INTO public.online_challenge_missions (
    challenge_id, legacy_key, title, description, schedule_type, fixed_date, target_count, sort_order
)
SELECT n.id,
       COALESCE(NULLIF(m.value->>'id', ''), 'legacy-' || (m.ordinality - 1)::text),
       COALESCE(NULLIF(trim(m.value->>'title'), ''), '미션 ' || m.ordinality::text),
       COALESCE(m.value->>'description', ''), 'FLEXIBLE', NULL, 1,
       (m.ordinality - 1)::integer
FROM public.notices n
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(n.challenge_missions, '[]'::jsonb))
    WITH ORDINALITY AS m(value, ordinality)
WHERE n.is_challenge AND n.challenge_format = 'ONLINE'
ON CONFLICT (challenge_id, legacy_key) DO UPDATE SET
    title = EXCLUDED.title, description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order, is_active = true, updated_at = now();

INSERT INTO public.offline_challenge_submissions (
    challenge_id, mission_id, participant_id, auth_text, auth_image_url, status,
    submitted_at, completed_at
)
SELECT nr.notice_id, om.id, nr.user_id,
       NULLIF(s.value->>'auth_text', ''), NULLIF(s.value->>'auth_image', ''),
       CASE WHEN COALESCE((s.value->>'completed')::boolean, false) THEN 'COMPLETED'
            WHEN COALESCE((s.value->>'pending')::boolean, false) THEN 'PENDING'
            ELSE 'REJECTED' END,
       COALESCE(NULLIF(s.value->>'submitted_at', '')::timestamptz, nr.created_at, now()),
       CASE WHEN COALESCE((s.value->>'completed')::boolean, false)
            THEN COALESCE(NULLIF(s.value->>'completed_at', '')::timestamptz,
                          NULLIF(s.value->>'submitted_at', '')::timestamptz, nr.created_at, now()) END
FROM public.notice_responses nr
JOIN public.notices n ON n.id = nr.notice_id AND n.is_challenge AND n.challenge_format = 'OFFLINE'
CROSS JOIN LATERAL jsonb_each(COALESCE(nr.challenge_mission_statuses, '{}'::jsonb)) AS s(key, value)
JOIN public.offline_challenge_missions om ON om.challenge_id = nr.notice_id AND om.legacy_key = s.key
ON CONFLICT (mission_id, participant_id) DO UPDATE SET
    auth_text = EXCLUDED.auth_text, auth_image_url = EXCLUDED.auth_image_url,
    status = EXCLUDED.status, submitted_at = EXCLUDED.submitted_at,
    completed_at = EXCLUDED.completed_at;

INSERT INTO public.community_post_media(post_id, media_url, sort_order)
SELECT id, image_url, 0 FROM public.community_channel_posts
WHERE NULLIF(trim(image_url), '') IS NOT NULL
ON CONFLICT (post_id, sort_order) DO NOTHING;

ALTER TABLE public.online_challenge_submissions DISABLE TRIGGER trg_prepare_online_challenge_submission;

INSERT INTO public.online_challenge_submissions(
    challenge_id, mission_id, participant_id, post_id, completion_date, completion_key
)
SELECT om.challenge_id, om.id, p.author_id, p.id,
       COALESCE(p.mission_date, (p.created_at AT TIME ZONE 'Asia/Seoul')::date), p.id::text
FROM public.community_channel_posts p
JOIN public.community_channels c ON c.id = p.channel_id
JOIN public.online_challenge_missions om
  ON om.challenge_id = c.source_notice_id AND om.legacy_key = p.mission_id
WHERE p.deleted_at IS NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.online_challenge_submissions ENABLE TRIGGER trg_prepare_online_challenge_submission;
