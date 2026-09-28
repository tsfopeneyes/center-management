BEGIN;

CREATE TEMP TABLE dm_push_test_actors AS
WITH staff AS (
    SELECT a.profile_id, a.auth_user_id
    FROM account_security.accounts a
    JOIN account_security.account_roles r USING (profile_id)
    JOIN public.users u ON u.id = a.profile_id
    WHERE a.mapping_verified AND a.status = 'active' AND r.enabled
      AND r.role IN ('admin', 'master') AND u.status IS DISTINCT FROM 'withdrawn'
    ORDER BY a.profile_id LIMIT 1
), students AS (
    SELECT a.profile_id, a.auth_user_id, row_number() OVER (ORDER BY a.profile_id) n
    FROM account_security.accounts a
    JOIN account_security.account_roles r USING (profile_id)
    JOIN public.users u ON u.id = a.profile_id
    WHERE a.mapping_verified AND a.status = 'active' AND r.enabled
      AND r.role = 'member' AND u.status IS DISTINCT FROM 'withdrawn'
    ORDER BY a.profile_id LIMIT 2
)
SELECT 'staff'::text actor, profile_id, auth_user_id FROM staff
UNION ALL SELECT 'student_' || n, profile_id, auth_user_id FROM students;

DO $$ BEGIN
    IF (SELECT count(*) FROM dm_push_test_actors) <> 3 THEN
        RAISE EXCEPTION 'DM push test fixtures are unavailable';
    END IF;
END $$;

GRANT SELECT ON dm_push_test_actors TO authenticated;
CREATE TEMP TABLE dm_push_test_state(direct_id uuid, group_id uuid, disabled_message bigint, queued_message bigint, group_message bigint);
GRANT SELECT, UPDATE ON dm_push_test_state TO authenticated;
INSERT INTO dm_push_test_state DEFAULT VALUES;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_push_test_actors WHERE actor='student_1'), true);
INSERT INTO public.dm_push_preferences(user_id, enabled, preview_enabled, group_enabled)
VALUES ((SELECT profile_id FROM dm_push_test_actors WHERE actor='student_1'), false, false, true);

SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_push_test_actors WHERE actor='staff'), true);
DO $$
DECLARE conversation_id uuid; sent public.dm_messages;
BEGIN
    conversation_id := public.dm_create_direct((SELECT profile_id FROM dm_push_test_actors WHERE actor='student_1'));
    sent := public.dm_send_message(conversation_id, '알림 꺼짐 검증');
    UPDATE dm_push_test_state SET direct_id=conversation_id, disabled_message=sent.id;
END $$;

RESET ROLE;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM public.dm_push_deliveries WHERE message_id=(SELECT disabled_message FROM dm_push_test_state)) THEN
        RAISE EXCEPTION 'Disabled DM push was queued';
    END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_push_test_actors WHERE actor='student_1'), true);
UPDATE public.dm_push_preferences SET enabled=true, preview_enabled=true, group_enabled=false, updated_at=clock_timestamp()
WHERE user_id=(SELECT profile_id FROM dm_push_test_actors WHERE actor='student_1');

SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_push_test_actors WHERE actor='staff'), true);
DO $$
DECLARE sent public.dm_messages; created_group uuid;
BEGIN
    sent := public.dm_send_message((SELECT direct_id FROM dm_push_test_state), '알림 켜짐 검증');
    UPDATE dm_push_test_state SET queued_message=sent.id;

    created_group := public.dm_create_group(
        (SELECT direct_id FROM dm_push_test_state),
        ARRAY[(SELECT profile_id FROM dm_push_test_actors WHERE actor='student_2')],
        '그룹 알림 검증'
    );
    sent := public.dm_send_message(created_group, '그룹 알림 검증');
    UPDATE dm_push_test_state SET group_id=created_group, group_message=sent.id;
END $$;

RESET ROLE;
DO $$ BEGIN
    IF (SELECT count(*) FROM public.dm_push_deliveries WHERE message_id=(SELECT queued_message FROM dm_push_test_state) AND state='PENDING') <> 1 THEN
        RAISE EXCEPTION 'Enabled direct-message push was not queued exactly once';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.dm_push_deliveries
        WHERE message_id=(SELECT group_message FROM dm_push_test_state)
          AND recipient_id=(SELECT profile_id FROM dm_push_test_actors WHERE actor='student_1')
    ) THEN RAISE EXCEPTION 'Group-muted recipient was queued'; END IF;
    IF (SELECT count(*) FROM public.dm_push_deliveries WHERE message_id=(SELECT group_message FROM dm_push_test_state)) <> 1 THEN
        RAISE EXCEPTION 'Group-enabled recipient was not queued';
    END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_push_test_actors WHERE actor='staff'), true);
SELECT public.dm_revoke_message((SELECT queued_message FROM dm_push_test_state));

RESET ROLE;
DO $$ BEGIN
    IF (SELECT state FROM public.dm_push_deliveries WHERE message_id=(SELECT queued_message FROM dm_push_test_state)) <> 'CANCELLED' THEN
        RAISE EXCEPTION 'Revoking a pending message did not cancel its push';
    END IF;
END $$;

SELECT json_build_object(
    'dm_push_off', true,
    'preview_preference_saved', true,
    'direct_push_queued', true,
    'group_push_off', true,
    'revoke_cancels_pending_push', true,
    'rolled_back', true
) AS dm_push_live_test;

ROLLBACK;
