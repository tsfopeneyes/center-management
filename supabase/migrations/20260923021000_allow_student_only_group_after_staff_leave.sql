-- A staff-created group may continue after every staff member leaves.
-- Creating groups, inviting participants, and renaming remain staff-only.
BEGIN;

CREATE OR REPLACE FUNCTION public.dm_leave_conversation(p_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
    actor uuid := public.current_profile_id();
    actor_name text;
    conversation_kind text;
    remaining_members integer;
BEGIN
    IF NOT public.dm_is_active_member(p_conversation_id, actor) THEN RAISE EXCEPTION 'membership_required'; END IF;
    SELECT name INTO actor_name FROM public.users WHERE id = actor;
    SELECT kind INTO conversation_kind FROM public.dm_conversations WHERE id = p_conversation_id;

    UPDATE public.dm_participant_memberships
    SET left_at = clock_timestamp()
    WHERE conversation_id = p_conversation_id AND user_id = actor AND left_at IS NULL;

    INSERT INTO public.dm_messages(conversation_id, sender_id, message_type, content)
    VALUES (p_conversation_id, actor, 'MEMBERSHIP_EVENT', actor_name || ' 님이 대화방에서 나갔어요.');

    SELECT count(*) INTO remaining_members
    FROM public.dm_participant_memberships
    WHERE conversation_id = p_conversation_id AND left_at IS NULL;

    IF remaining_members = 0 OR (conversation_kind = 'DIRECT' AND remaining_members < 2) THEN
        UPDATE public.dm_conversations
        SET status = 'ARCHIVED', updated_at = clock_timestamp()
        WHERE id = p_conversation_id;
    END IF;
END;
$$;

COMMIT;
