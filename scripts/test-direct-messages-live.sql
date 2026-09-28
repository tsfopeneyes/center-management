BEGIN;

CREATE TEMP TABLE dm_test_actors AS
WITH staff AS (
    SELECT a.profile_id, a.auth_user_id
    FROM account_security.accounts a
    JOIN account_security.account_roles r USING (profile_id)
    JOIN public.users u ON u.id = a.profile_id
    WHERE a.mapping_verified IS TRUE
      AND a.status = 'active'
      AND r.enabled IS TRUE
      AND r.role IN ('admin', 'master')
      AND u.status IS DISTINCT FROM 'withdrawn'
    ORDER BY a.profile_id
    LIMIT 1
), students AS (
    SELECT a.profile_id, a.auth_user_id, row_number() OVER (ORDER BY a.profile_id) AS n
    FROM account_security.accounts a
    JOIN account_security.account_roles r USING (profile_id)
    JOIN public.users u ON u.id = a.profile_id
    WHERE a.mapping_verified IS TRUE
      AND a.status = 'active'
      AND r.enabled IS TRUE
      AND r.role = 'member'
      AND u.status IS DISTINCT FROM 'withdrawn'
    ORDER BY a.profile_id
    LIMIT 3
)
SELECT 'staff'::text AS actor, profile_id, auth_user_id FROM staff
UNION ALL
SELECT 'student_' || n::text, profile_id, auth_user_id FROM students;

DO $$
BEGIN
    IF (SELECT count(*) FROM dm_test_actors WHERE actor = 'staff') <> 1
       OR (SELECT count(*) FROM dm_test_actors WHERE actor LIKE 'student_%') <> 3 THEN
        RAISE EXCEPTION 'Live DM test requires one staff and three active students';
    END IF;
END;
$$;

CREATE TEMP TABLE dm_test_state (
    direct_id uuid,
    group_id uuid,
    early_message_id bigint,
    later_message_id bigint,
    revoked_message_id bigint,
    report_id uuid,
    legacy_message_count bigint
);

GRANT SELECT ON dm_test_actors TO authenticated;
GRANT SELECT, UPDATE ON dm_test_state TO authenticated;

INSERT INTO dm_test_state(legacy_message_count)
SELECT count(*) FROM public.messages;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_test_actors WHERE actor = 'student_1'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
DECLARE
    staff_id uuid := (SELECT profile_id FROM dm_test_actors WHERE actor = 'staff');
    student_2 uuid := (SELECT profile_id FROM dm_test_actors WHERE actor = 'student_2');
    first_direct uuid;
    second_direct uuid;
BEGIN
    first_direct := public.dm_create_direct(staff_id);
    second_direct := public.dm_create_direct(staff_id);
    IF first_direct IS DISTINCT FROM second_direct THEN
        RAISE EXCEPTION 'Opening the same direct conversation created a duplicate';
    END IF;
    UPDATE dm_test_state SET direct_id = first_direct;

    BEGIN
        PERFORM public.dm_create_direct(student_2);
        RAISE EXCEPTION 'Student-to-student direct conversation was allowed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'Student-to-student direct conversation was allowed' THEN RAISE; END IF;
    END;

    IF (SELECT count(*) FROM public.dm_conversations WHERE id = first_direct) <> 1 THEN
        RAISE EXCEPTION 'Direct conversation is not visible to its student participant';
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_test_actors WHERE actor = 'staff'), true);

DO $$
DECLARE
    direct_id uuid := (SELECT direct_id FROM dm_test_state);
    student_2 uuid := (SELECT profile_id FROM dm_test_actors WHERE actor = 'student_2');
    made_group uuid;
    early_id bigint;
BEGIN
    made_group := public.dm_create_group(direct_id, ARRAY[student_2], '운영 롤백 테스트');
    PERFORM public.dm_rename_group(made_group, '이름 변경 확인');
    early_id := (public.dm_send_message(made_group, '초대 전 메시지')).id;
    UPDATE dm_test_state SET group_id = made_group, early_message_id = early_id;

    IF (SELECT title FROM public.dm_conversations WHERE id = made_group) <> '이름 변경 확인' THEN
        RAISE EXCEPTION 'Group title rename failed';
    END IF;

    BEGIN
        PERFORM public.dm_leave_conversation(made_group);
        RAISE EXCEPTION 'Last staff member was allowed to abandon students';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'Last staff member was allowed to abandon students' THEN RAISE; END IF;
    END;
END;
$$;

SELECT public.dm_invite_participant(
    (SELECT group_id FROM dm_test_state),
    (SELECT profile_id FROM dm_test_actors WHERE actor = 'student_3')
);

SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_test_actors WHERE actor = 'student_3'), true);

DO $$
DECLARE
    group_id uuid := (SELECT group_id FROM dm_test_state);
    early_id bigint := (SELECT early_message_id FROM dm_test_state);
    later_id bigint;
    me uuid := (SELECT profile_id FROM dm_test_actors WHERE actor = 'student_3');
BEGIN
    IF public.dm_can_read_message(early_id) THEN
        RAISE EXCEPTION 'Late participant can read earlier messages';
    END IF;

    later_id := (public.dm_send_message(group_id, '초대 후 메시지')).id;
    UPDATE dm_test_state SET later_message_id = later_id;
    PERFORM public.dm_toggle_reaction(later_id, '👍');
    PERFORM public.dm_toggle_reaction(later_id, '❤️');

    IF (SELECT count(*) FROM public.dm_message_reactions WHERE message_id = later_id) <> 2 THEN
        RAISE EXCEPTION 'Multiple emoji reactions were not stored';
    END IF;

    INSERT INTO public.dm_typing_states(conversation_id, user_id)
    VALUES (group_id, me)
    ON CONFLICT (conversation_id, user_id) DO UPDATE SET updated_at = clock_timestamp();

    IF (SELECT count(*) FROM public.dm_typing_states WHERE conversation_id = group_id AND user_id = me) <> 1 THEN
        RAISE EXCEPTION 'Typing state was not visible';
    END IF;

    PERFORM public.dm_mark_read(group_id);
    IF NOT EXISTS (
        SELECT 1 FROM public.dm_participant_memberships
        WHERE conversation_id = group_id AND user_id = me AND last_read_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Read marker was not updated';
    END IF;

    PERFORM public.dm_leave_conversation(group_id);
    IF public.dm_is_active_member(group_id) THEN
        RAISE EXCEPTION 'Student remained active after leaving';
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_test_actors WHERE actor = 'student_2'), true);

DO $$
DECLARE
    group_id uuid := (SELECT group_id FROM dm_test_state);
    revoked_id bigint;
    made_report uuid;
    snapshot jsonb;
BEGIN
    revoked_id := (public.dm_send_message(group_id, '취소 및 신고 보존 확인')).id;
    PERFORM public.dm_revoke_message(revoked_id);

    IF EXISTS (SELECT 1 FROM public.dm_messages WHERE id = revoked_id AND content IS NOT NULL) THEN
        RAISE EXCEPTION 'Revoked message content remained in the visible message table';
    END IF;

    made_report := public.dm_report_conversation(group_id);
    SELECT message_snapshot INTO snapshot FROM public.dm_conversation_reports WHERE id = made_report;
    IF snapshot::text NOT LIKE '%취소 및 신고 보존 확인%' THEN
        RAISE EXCEPTION 'Report did not preserve the revoked original';
    END IF;
    UPDATE dm_test_state SET revoked_message_id = revoked_id, report_id = made_report;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', '', true);

UPDATE account_security.account_roles
SET role = 'member'
WHERE profile_id = (SELECT profile_id FROM dm_test_actors WHERE actor = 'staff');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM dm_test_actors WHERE actor = 'staff'), true);

DO $$
DECLARE
    group_id uuid := (SELECT group_id FROM dm_test_state);
BEGIN
    IF public.dm_is_active_member(group_id) THEN
        RAISE EXCEPTION 'Former staff retained active DM membership after role downgrade';
    END IF;
    IF EXISTS (SELECT 1 FROM public.dm_conversations WHERE id = group_id) THEN
        RAISE EXCEPTION 'RLS exposed a former staff conversation after role downgrade';
    END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
    IF (SELECT count(*) FROM public.messages) <> (SELECT legacy_message_count FROM dm_test_state) THEN
        RAISE EXCEPTION 'Legacy/system notification messages changed during DM operations';
    END IF;
END;
$$;

SELECT json_build_object(
    'direct_reuse', true,
    'student_to_student_blocked', true,
    'group_created_and_renamed', true,
    'late_history_hidden', true,
    'multiple_reactions', true,
    'typing_and_read_state', true,
    'student_leave', true,
    'revoke_and_report_snapshot', true,
    'staff_revocation_blocked', true,
    'legacy_notifications_untouched', true,
    'rolled_back', true
) AS dm_live_test;

ROLLBACK;
