BEGIN;

CREATE TEMP TABLE dm_staff_test_actors AS
WITH staff AS (
    SELECT a.profile_id, a.auth_user_id, row_number() OVER (ORDER BY a.profile_id) AS n
    FROM account_security.accounts a
    JOIN account_security.account_roles r USING (profile_id)
    JOIN public.users u ON u.id = a.profile_id
    WHERE a.mapping_verified AND a.status = 'active' AND r.enabled
      AND r.role IN ('admin', 'master') AND u.status IS DISTINCT FROM 'withdrawn'
    LIMIT 2
), students AS (
    SELECT a.profile_id, a.auth_user_id, row_number() OVER (ORDER BY a.profile_id) AS n
    FROM account_security.accounts a
    JOIN account_security.account_roles r USING (profile_id)
    JOIN public.users u ON u.id = a.profile_id
    WHERE a.mapping_verified AND a.status = 'active' AND r.enabled
      AND r.role = 'member' AND u.status IS DISTINCT FROM 'withdrawn'
    LIMIT 2
)
SELECT 'staff_' || n AS actor, profile_id, auth_user_id FROM staff
UNION ALL
SELECT 'student_' || n AS actor, profile_id, auth_user_id FROM students;

DO $$ BEGIN
    IF (SELECT count(*) FROM dm_staff_test_actors WHERE actor LIKE 'staff_%') <> 2
       OR (SELECT count(*) FROM dm_staff_test_actors WHERE actor LIKE 'student_%') <> 2 THEN
        RAISE EXCEPTION 'two active staff and students are required';
    END IF;
END $$;

CREATE TEMP TABLE dm_staff_test_state(conversation_id uuid, message_id bigint, group_id uuid);
GRANT SELECT, INSERT, UPDATE ON dm_staff_test_state TO authenticated;
GRANT SELECT ON dm_staff_test_actors TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_staff_test_actors WHERE actor='staff_1'), true);

DO $$
DECLARE first_id uuid; repeated_id uuid; sent_id bigint;
BEGIN
    first_id := public.dm_create_direct((SELECT profile_id FROM dm_staff_test_actors WHERE actor='staff_2'));
    repeated_id := public.dm_create_direct((SELECT profile_id FROM dm_staff_test_actors WHERE actor='staff_2'));
    IF first_id IS DISTINCT FROM repeated_id THEN RAISE EXCEPTION 'staff direct duplicated'; END IF;
    sent_id := (public.dm_send_message(first_id, 'staff direct rollback test')).id;
    INSERT INTO dm_staff_test_state VALUES (first_id, sent_id);
END $$;

SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_staff_test_actors WHERE actor='staff_2'), true);
DO $$
DECLARE same_id uuid; reply_id bigint;
BEGIN
    same_id := public.dm_create_direct((SELECT profile_id FROM dm_staff_test_actors WHERE actor='staff_1'));
    IF same_id IS DISTINCT FROM (SELECT conversation_id FROM dm_staff_test_state) THEN RAISE EXCEPTION 'reverse staff direct duplicated'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.dm_messages WHERE id=(SELECT message_id FROM dm_staff_test_state)) THEN RAISE EXCEPTION 'staff recipient cannot read message'; END IF;
    reply_id := (public.dm_send_message(same_id, 'staff direct reply rollback test')).id;
    PERFORM public.dm_leave_conversation(same_id);
    IF EXISTS (SELECT 1 FROM public.dm_participant_memberships WHERE conversation_id=same_id AND user_id=(SELECT profile_id FROM dm_staff_test_actors WHERE actor='staff_2') AND left_at IS NULL) THEN RAISE EXCEPTION 'leaving staff remained active'; END IF;
    IF (SELECT status FROM public.dm_conversations WHERE id=same_id) <> 'ARCHIVED' THEN RAISE EXCEPTION 'one-person direct room was not archived'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_staff_test_actors WHERE actor='student_1'), true);
DO $$ BEGIN
    BEGIN
        PERFORM public.dm_create_direct((SELECT profile_id FROM dm_staff_test_actors WHERE actor='student_2'));
        RAISE EXCEPTION 'student direct unexpectedly allowed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'student direct unexpectedly allowed' THEN RAISE; END IF;
        IF SQLERRM <> 'student_to_student_direct_not_allowed' THEN RAISE; END IF;
    END;
END $$;

SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_staff_test_actors WHERE actor='staff_1'), true);
DO $$
DECLARE source_id uuid; created_group uuid; first_message_group uuid;
BEGIN
    first_message_group := public.dm_start_conversation(
        ARRAY[(SELECT profile_id FROM dm_staff_test_actors WHERE actor='student_1'), (SELECT profile_id FROM dm_staff_test_actors WHERE actor='student_2')],
        'atomic first message rollback test'
    );
    IF (SELECT count(*) FROM public.dm_messages WHERE conversation_id=first_message_group AND message_type='TEXT') <> 1 THEN RAISE EXCEPTION 'first-message group was not atomic'; END IF;
    source_id := public.dm_create_direct((SELECT profile_id FROM dm_staff_test_actors WHERE actor='student_1'));
    created_group := public.dm_create_group(source_id, ARRAY[(SELECT profile_id FROM dm_staff_test_actors WHERE actor='student_2')], 'student continuation rollback test');
    UPDATE dm_staff_test_state SET group_id=created_group;
    PERFORM public.dm_leave_conversation(created_group);
    IF (SELECT status FROM public.dm_conversations WHERE id=created_group) <> 'ACTIVE' THEN RAISE EXCEPTION 'student-only group was archived'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_staff_test_actors WHERE actor='student_1'), true);
DO $$ BEGIN
    PERFORM public.dm_send_message((SELECT group_id FROM dm_staff_test_state), 'student continuation rollback reply');
    BEGIN
        PERFORM public.dm_invite_participant((SELECT group_id FROM dm_staff_test_state), (SELECT profile_id FROM dm_staff_test_actors WHERE actor='staff_2'));
        RAISE EXCEPTION 'student invite unexpectedly allowed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'student invite unexpectedly allowed' THEN RAISE; END IF;
        IF SQLERRM <> 'staff_membership_required' THEN RAISE; END IF;
    END;
END $$;

RESET ROLE;
SELECT true AS staff_direct_create, true AS duplicate_prevention,
       true AS bidirectional_messages, true AS staff_leave,
       true AS student_direct_blocked, true AS student_group_continues,
       true AS student_invite_blocked, true AS first_message_creates_room;
ROLLBACK;
