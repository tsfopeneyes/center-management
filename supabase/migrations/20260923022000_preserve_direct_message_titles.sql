-- Preserve each participant's direct-message title even after the counterpart leaves.
BEGIN;

ALTER TABLE public.dm_participant_memberships
    ADD COLUMN display_title text;

UPDATE public.dm_participant_memberships membership
SET display_title = (
    SELECT users.name
    FROM public.dm_participant_memberships other_membership
    JOIN public.users users ON users.id = other_membership.user_id
    WHERE other_membership.conversation_id = membership.conversation_id
      AND other_membership.user_id <> membership.user_id
    ORDER BY other_membership.joined_at, other_membership.id
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM public.dm_conversations conversation
    WHERE conversation.id = membership.conversation_id
      AND conversation.kind = 'DIRECT'
);

CREATE OR REPLACE FUNCTION public.dm_create_direct(p_other_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
    actor uuid := public.current_profile_id();
    actor_staff boolean := public.is_current_staff();
    other_staff boolean;
    actor_name text;
    other_name text;
    result uuid;
BEGIN
    IF actor IS NULL OR p_other_user_id IS NULL OR actor = p_other_user_id THEN RAISE EXCEPTION 'invalid_participant'; END IF;
    SELECT u.name INTO other_name
    FROM account_security.accounts a JOIN public.users u ON u.id = a.profile_id
    WHERE a.profile_id = p_other_user_id AND a.mapping_verified AND a.status = 'active' AND u.status IS DISTINCT FROM 'withdrawn';
    IF other_name IS NULL THEN RAISE EXCEPTION 'inactive_participant'; END IF;
    SELECT name INTO actor_name FROM public.users WHERE id = actor;
    SELECT EXISTS (
        SELECT 1 FROM account_security.account_roles r JOIN public.users u ON u.id = r.profile_id
        WHERE r.profile_id = p_other_user_id AND r.enabled AND r.role IN ('admin','master') AND u.status IS DISTINCT FROM 'withdrawn'
    ) INTO other_staff;
    IF NOT actor_staff AND NOT other_staff THEN RAISE EXCEPTION 'student_to_student_direct_not_allowed'; END IF;

    SELECT c.id INTO result
    FROM public.dm_conversations c
    JOIN public.dm_participant_memberships mine ON mine.conversation_id = c.id AND mine.user_id = actor AND mine.left_at IS NULL
    JOIN public.dm_participant_memberships theirs ON theirs.conversation_id = c.id AND theirs.user_id = p_other_user_id AND theirs.left_at IS NULL
    WHERE c.kind = 'DIRECT' AND c.status = 'ACTIVE'
      AND (SELECT count(*) FROM public.dm_participant_memberships m WHERE m.conversation_id = c.id AND m.left_at IS NULL) = 2
    LIMIT 1;
    IF result IS NOT NULL THEN RETURN result; END IF;

    INSERT INTO public.dm_conversations(kind, created_by) VALUES ('DIRECT', actor) RETURNING id INTO result;
    INSERT INTO public.dm_participant_memberships(conversation_id, user_id, invited_by, display_title)
    VALUES (result, actor, actor, other_name), (result, p_other_user_id, actor, actor_name);
    RETURN result;
END;
$$;

COMMIT;
