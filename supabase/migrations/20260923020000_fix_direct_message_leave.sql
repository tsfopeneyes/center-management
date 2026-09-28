-- Leaving must always remove the caller immediately. If the remaining room
-- would be a one-person direct chat or a student-only group, close the room.
BEGIN;

CREATE OR REPLACE FUNCTION public.dm_leave_conversation(p_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
    actor uuid := public.current_profile_id();
    actor_name text;
    remaining_members integer;
    remaining_staff integer;
BEGIN
    IF NOT public.dm_is_active_member(p_conversation_id, actor) THEN RAISE EXCEPTION 'membership_required'; END IF;
    SELECT name INTO actor_name FROM public.users WHERE id = actor;

    UPDATE public.dm_participant_memberships
    SET left_at = clock_timestamp()
    WHERE conversation_id = p_conversation_id AND user_id = actor AND left_at IS NULL;

    INSERT INTO public.dm_messages(conversation_id, sender_id, message_type, content)
    VALUES (p_conversation_id, actor, 'MEMBERSHIP_EVENT', actor_name || ' 님이 대화방에서 나갔어요.');

    SELECT count(*), count(*) FILTER (WHERE r.role IN ('admin','master') AND r.enabled)
      INTO remaining_members, remaining_staff
    FROM public.dm_participant_memberships m
    LEFT JOIN account_security.account_roles r ON r.profile_id = m.user_id
    WHERE m.conversation_id = p_conversation_id AND m.left_at IS NULL;

    IF remaining_members < 2 OR remaining_staff = 0 THEN
        UPDATE public.dm_conversations
        SET status = 'ARCHIVED', updated_at = clock_timestamp()
        WHERE id = p_conversation_id;
    END IF;
END;
$$;

COMMIT;
