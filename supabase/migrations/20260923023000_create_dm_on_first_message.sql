-- Create a selected direct/group conversation atomically with its first message.
-- Merely selecting recipients never creates an empty conversation.
BEGIN;

CREATE OR REPLACE FUNCTION public.dm_start_conversation(p_recipient_ids uuid[], p_content text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
    actor uuid := public.current_profile_id();
    recipients uuid[];
    recipient_count integer;
    result uuid;
BEGIN
    SELECT coalesce(array_agg(DISTINCT recipient), ARRAY[]::uuid[])
      INTO recipients
    FROM unnest(coalesce(p_recipient_ids, ARRAY[]::uuid[])) recipient
    WHERE recipient IS NOT NULL AND recipient <> actor;
    recipient_count := cardinality(recipients);

    IF actor IS NULL OR recipient_count = 0 OR length(btrim(p_content)) NOT BETWEEN 1 AND 2000 THEN
        RAISE EXCEPTION 'invalid_conversation_start';
    END IF;

    IF recipient_count = 1 THEN
        result := public.dm_create_direct(recipients[1]);
        PERFORM public.dm_send_message(result, p_content);
        RETURN result;
    END IF;

    IF NOT public.is_current_staff() THEN RAISE EXCEPTION 'staff_required_for_group'; END IF;
    IF (
        SELECT count(*)
        FROM account_security.accounts account
        JOIN public.users users ON users.id = account.profile_id
        WHERE account.profile_id = ANY(recipients)
          AND account.mapping_verified AND account.status = 'active'
          AND users.status IS DISTINCT FROM 'withdrawn'
    ) <> recipient_count THEN RAISE EXCEPTION 'inactive_participant'; END IF;

    INSERT INTO public.dm_conversations(kind, created_by)
    VALUES ('GROUP', actor) RETURNING id INTO result;
    INSERT INTO public.dm_participant_memberships(conversation_id, user_id, invited_by)
    VALUES (result, actor, actor);
    INSERT INTO public.dm_participant_memberships(conversation_id, user_id, invited_by)
    SELECT result, recipient, actor FROM unnest(recipients) recipient;
    PERFORM public.dm_send_message(result, p_content);
    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.dm_start_conversation(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dm_start_conversation(uuid[], text) TO authenticated, service_role;

COMMIT;
