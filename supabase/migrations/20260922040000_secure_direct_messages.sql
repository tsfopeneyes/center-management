-- Private direct and group messages. This intentionally does not reuse the
-- legacy public.messages table, which also contains application notices.
BEGIN;

CREATE TABLE public.dm_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (kind IN ('DIRECT', 'GROUP')),
    title text CHECK (title IS NULL OR (length(btrim(title)) BETWEEN 1 AND 40)),
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED', 'ARCHIVED')),
    created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    last_message_at timestamptz
);

CREATE TABLE public.dm_participant_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    invited_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    left_at timestamptz,
    last_read_at timestamptz,
    CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE UNIQUE INDEX dm_one_active_membership
    ON public.dm_participant_memberships(conversation_id, user_id)
    WHERE left_at IS NULL;
CREATE INDEX dm_memberships_user_active
    ON public.dm_participant_memberships(user_id, conversation_id)
    WHERE left_at IS NULL;

CREATE TABLE public.dm_messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    message_type text NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'MEMBERSHIP_EVENT', 'TITLE_EVENT')),
    content text,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    revoked_at timestamptz,
    revoked_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    CHECK (
        (message_type = 'TEXT' AND ((revoked_at IS NULL AND length(btrim(content)) BETWEEN 1 AND 2000) OR (revoked_at IS NOT NULL AND content IS NULL)))
        OR (message_type <> 'TEXT' AND revoked_at IS NULL AND length(btrim(content)) BETWEEN 1 AND 500)
    )
);
CREATE INDEX dm_messages_thread_time ON public.dm_messages(conversation_id, created_at DESC, id DESC);

CREATE TABLE public.dm_message_reactions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id bigint NOT NULL REFERENCES public.dm_messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    membership_id uuid NOT NULL REFERENCES public.dm_participant_memberships(id) ON DELETE RESTRICT,
    emoji text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 32),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(message_id, user_id, emoji)
);
CREATE INDEX dm_reactions_message ON public.dm_message_reactions(message_id);

CREATE TABLE public.dm_typing_states (
    conversation_id uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(conversation_id, user_id)
);

-- Only the safety/reporting functions below may read this table.
CREATE TABLE public.dm_message_safety_archive (
    message_id bigint PRIMARY KEY REFERENCES public.dm_messages(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    original_content text NOT NULL,
    sent_at timestamptz NOT NULL,
    revoked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '30 days'),
    reported_at timestamptz
);

CREATE TABLE public.dm_conversation_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE RESTRICT,
    reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    message_snapshot jsonb NOT NULL,
    participant_snapshot jsonb NOT NULL,
    status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    resolved_at timestamptz,
    UNIQUE(conversation_id, reporter_id)
);

ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_participant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_typing_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_message_safety_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_conversation_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.dm_message_safety_archive FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.dm_conversation_reports FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.dm_conversations, public.dm_participant_memberships, public.dm_messages, public.dm_message_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_typing_states TO authenticated;
GRANT SELECT, INSERT ON public.dm_conversation_reports TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.dm_messages_id_seq, public.dm_message_reactions_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.dm_is_active_member(p_conversation_id uuid, p_profile_id uuid DEFAULT public.current_profile_id())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.dm_participant_memberships m
        JOIN public.users u ON u.id = m.user_id
        WHERE m.conversation_id = p_conversation_id
          AND m.user_id = p_profile_id AND m.left_at IS NULL
          AND u.status IS DISTINCT FROM 'withdrawn'
          AND (
              NOT EXISTS (
                  SELECT 1 FROM account_security.account_roles ar
                  WHERE ar.profile_id = p_profile_id AND ar.role IN ('admin', 'master')
              )
              OR public.is_current_staff()
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.dm_can_read_message(p_message_id bigint, p_profile_id uuid DEFAULT public.current_profile_id())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.dm_messages msg
        JOIN public.dm_participant_memberships m ON m.conversation_id = msg.conversation_id
        JOIN public.users u ON u.id = m.user_id
        WHERE msg.id = p_message_id AND m.user_id = p_profile_id AND m.left_at IS NULL
          AND msg.created_at >= m.joined_at AND u.status IS DISTINCT FROM 'withdrawn'
          AND (NOT EXISTS (
              SELECT 1 FROM account_security.account_roles ar
              WHERE ar.profile_id = p_profile_id AND ar.role IN ('admin', 'master')
          ) OR public.is_current_staff())
    );
$$;

REVOKE ALL ON FUNCTION public.dm_is_active_member(uuid, uuid), public.dm_can_read_message(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dm_is_active_member(uuid, uuid), public.dm_can_read_message(bigint, uuid) TO authenticated, service_role;

CREATE POLICY dm_conversations_read ON public.dm_conversations FOR SELECT TO authenticated
USING (public.dm_is_active_member(id));
CREATE POLICY dm_memberships_read ON public.dm_participant_memberships FOR SELECT TO authenticated
USING (left_at IS NULL AND public.dm_is_active_member(conversation_id));
CREATE POLICY dm_messages_read ON public.dm_messages FOR SELECT TO authenticated
USING (public.dm_can_read_message(id));
CREATE POLICY dm_reactions_read ON public.dm_message_reactions FOR SELECT TO authenticated
USING (public.dm_can_read_message(message_id));
CREATE POLICY dm_typing_read ON public.dm_typing_states FOR SELECT TO authenticated
USING (public.dm_is_active_member(conversation_id) AND updated_at > clock_timestamp() - interval '5 seconds');
CREATE POLICY dm_typing_insert ON public.dm_typing_states FOR INSERT TO authenticated
WITH CHECK (user_id = public.current_profile_id() AND public.dm_is_active_member(conversation_id));
CREATE POLICY dm_typing_update ON public.dm_typing_states FOR UPDATE TO authenticated
USING (user_id = public.current_profile_id() AND public.dm_is_active_member(conversation_id))
WITH CHECK (user_id = public.current_profile_id() AND public.dm_is_active_member(conversation_id));
CREATE POLICY dm_typing_delete ON public.dm_typing_states FOR DELETE TO authenticated
USING (user_id = public.current_profile_id());
CREATE POLICY dm_reports_own_read ON public.dm_conversation_reports FOR SELECT TO authenticated
USING (public.is_current_profile(reporter_id));

-- Direct table fallbacks remain safe because the same invariants are enforced
-- by RLS. Multi-row operations use the RPCs below for atomicity.
CREATE POLICY dm_messages_insert ON public.dm_messages FOR INSERT TO authenticated WITH CHECK (
    message_type = 'TEXT' AND sender_id = public.current_profile_id()
    AND public.dm_is_active_member(conversation_id)
    AND EXISTS (SELECT 1 FROM public.dm_conversations c WHERE c.id = conversation_id AND c.status = 'ACTIVE')
);
CREATE POLICY dm_reactions_insert ON public.dm_message_reactions FOR INSERT TO authenticated WITH CHECK (
    user_id = public.current_profile_id() AND public.dm_can_read_message(message_id)
    AND EXISTS (SELECT 1 FROM public.dm_participant_memberships m WHERE m.id = membership_id AND m.user_id = public.current_profile_id() AND m.left_at IS NULL)
);
CREATE POLICY dm_reactions_delete ON public.dm_message_reactions FOR DELETE TO authenticated
USING (user_id = public.current_profile_id());

CREATE OR REPLACE FUNCTION public.dm_create_direct(p_other_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
    actor uuid := public.current_profile_id();
    actor_staff boolean := public.is_current_staff();
    other_staff boolean;
    result uuid;
BEGIN
    IF actor IS NULL OR p_other_user_id IS NULL OR actor = p_other_user_id THEN RAISE EXCEPTION 'invalid_participant'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM account_security.accounts a JOIN public.users u ON u.id = a.profile_id
        WHERE a.profile_id = p_other_user_id AND a.mapping_verified AND a.status = 'active' AND u.status IS DISTINCT FROM 'withdrawn'
    ) THEN RAISE EXCEPTION 'inactive_participant'; END IF;
    SELECT EXISTS (
        SELECT 1 FROM account_security.account_roles r JOIN public.users u ON u.id = r.profile_id
        WHERE r.profile_id = p_other_user_id AND r.enabled AND r.role IN ('admin','master') AND u.status IS DISTINCT FROM 'withdrawn'
    ) INTO other_staff;
    IF actor_staff = other_staff THEN RAISE EXCEPTION 'direct_dm_requires_student_and_staff'; END IF;

    SELECT c.id INTO result
    FROM public.dm_conversations c
    JOIN public.dm_participant_memberships mine ON mine.conversation_id = c.id AND mine.user_id = actor AND mine.left_at IS NULL
    JOIN public.dm_participant_memberships theirs ON theirs.conversation_id = c.id AND theirs.user_id = p_other_user_id AND theirs.left_at IS NULL
    WHERE c.kind = 'DIRECT' AND c.status = 'ACTIVE'
      AND (SELECT count(*) FROM public.dm_participant_memberships m WHERE m.conversation_id = c.id AND m.left_at IS NULL) = 2
    LIMIT 1;
    IF result IS NOT NULL THEN RETURN result; END IF;

    INSERT INTO public.dm_conversations(kind, created_by) VALUES ('DIRECT', actor) RETURNING id INTO result;
    INSERT INTO public.dm_participant_memberships(conversation_id, user_id, invited_by)
    VALUES (result, actor, actor), (result, p_other_user_id, actor);
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_create_group(p_source_conversation_id uuid, p_invited_user_ids uuid[], p_title text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := public.current_profile_id(); result uuid; member uuid;
BEGIN
    IF NOT public.is_current_staff() OR NOT public.dm_is_active_member(p_source_conversation_id, actor) THEN RAISE EXCEPTION 'staff_membership_required'; END IF;
    INSERT INTO public.dm_conversations(kind, title, created_by)
    VALUES ('GROUP', nullif(left(btrim(p_title), 40), ''), actor) RETURNING id INTO result;
    INSERT INTO public.dm_participant_memberships(conversation_id, user_id, invited_by)
    SELECT result, source.user_id, actor FROM public.dm_participant_memberships source
    WHERE source.conversation_id = p_source_conversation_id AND source.left_at IS NULL;
    FOREACH member IN ARRAY coalesce(p_invited_user_ids, ARRAY[]::uuid[]) LOOP
        IF EXISTS (
            SELECT 1 FROM account_security.accounts a JOIN public.users u ON u.id = a.profile_id
            WHERE a.profile_id = member AND a.mapping_verified AND a.status = 'active' AND u.status IS DISTINCT FROM 'withdrawn'
        ) THEN
            INSERT INTO public.dm_participant_memberships(conversation_id, user_id, invited_by)
            VALUES (result, member, actor) ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
    IF (SELECT count(*) FROM public.dm_participant_memberships WHERE conversation_id = result) < 3 THEN RAISE EXCEPTION 'group_requires_three_participants'; END IF;
    INSERT INTO public.dm_messages(conversation_id, sender_id, message_type, content)
    VALUES (result, actor, 'MEMBERSHIP_EVENT', '그룹 대화가 시작되었어요.');
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_invite_participant(p_conversation_id uuid, p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := public.current_profile_id(); membership uuid; invited_name text;
BEGIN
    IF NOT public.is_current_staff() OR NOT public.dm_is_active_member(p_conversation_id, actor) THEN RAISE EXCEPTION 'staff_membership_required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.dm_conversations WHERE id = p_conversation_id AND kind = 'GROUP' AND status = 'ACTIVE') THEN RAISE EXCEPTION 'group_required'; END IF;
    SELECT u.name INTO invited_name FROM public.users u JOIN account_security.accounts a ON a.profile_id = u.id
    WHERE u.id = p_user_id AND u.status IS DISTINCT FROM 'withdrawn' AND a.mapping_verified AND a.status = 'active';
    IF invited_name IS NULL THEN RAISE EXCEPTION 'invalid_participant'; END IF;
    INSERT INTO public.dm_participant_memberships(conversation_id, user_id, invited_by)
    VALUES (p_conversation_id, p_user_id, actor) RETURNING id INTO membership;
    INSERT INTO public.dm_messages(conversation_id, sender_id, message_type, content)
    VALUES (p_conversation_id, actor, 'MEMBERSHIP_EVENT', invited_name || ' 님이 대화에 참여했어요.');
    RETURN membership;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_send_message(p_conversation_id uuid, p_content text)
RETURNS public.dm_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := public.current_profile_id(); result public.dm_messages;
BEGIN
    IF NOT public.dm_is_active_member(p_conversation_id, actor) OR length(btrim(p_content)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'invalid_message'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.dm_conversations WHERE id = p_conversation_id AND status = 'ACTIVE') THEN RAISE EXCEPTION 'conversation_unavailable'; END IF;
    INSERT INTO public.dm_messages(conversation_id, sender_id, content) VALUES (p_conversation_id, actor, btrim(p_content)) RETURNING * INTO result;
    UPDATE public.dm_conversations SET updated_at = result.created_at, last_message_at = result.created_at WHERE id = p_conversation_id;
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_revoke_message(p_message_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := public.current_profile_id(); source public.dm_messages;
BEGIN
    SELECT * INTO source FROM public.dm_messages WHERE id = p_message_id FOR UPDATE;
    IF source.sender_id <> actor OR source.message_type <> 'TEXT' OR source.revoked_at IS NOT NULL OR source.created_at < clock_timestamp() - interval '10 minutes' OR NOT public.dm_is_active_member(source.conversation_id, actor) THEN RAISE EXCEPTION 'message_cannot_be_revoked'; END IF;
    INSERT INTO public.dm_message_safety_archive(message_id, conversation_id, sender_id, original_content, sent_at)
    VALUES (source.id, source.conversation_id, actor, source.content, source.created_at);
    DELETE FROM public.dm_message_reactions WHERE message_id = source.id;
    UPDATE public.dm_messages SET content = NULL, revoked_at = clock_timestamp(), revoked_by = actor WHERE id = source.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_toggle_reaction(p_message_id bigint, p_emoji text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := public.current_profile_id(); active_membership uuid; removed bigint;
BEGIN
    IF length(p_emoji) NOT BETWEEN 1 AND 32 OR NOT public.dm_can_read_message(p_message_id, actor) OR EXISTS (SELECT 1 FROM public.dm_messages WHERE id = p_message_id AND revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'reaction_not_allowed'; END IF;
    SELECT m.id INTO active_membership FROM public.dm_participant_memberships m JOIN public.dm_messages msg ON msg.conversation_id = m.conversation_id WHERE msg.id = p_message_id AND m.user_id = actor AND m.left_at IS NULL;
    DELETE FROM public.dm_message_reactions WHERE message_id = p_message_id AND user_id = actor AND emoji = p_emoji;
    GET DIAGNOSTICS removed = ROW_COUNT;
    IF removed > 0 THEN RETURN false; END IF;
    IF (SELECT count(*) FROM public.dm_message_reactions WHERE message_id = p_message_id AND user_id = actor) >= 10 THEN RAISE EXCEPTION 'reaction_limit'; END IF;
    INSERT INTO public.dm_message_reactions(message_id, user_id, membership_id, emoji) VALUES (p_message_id, actor, active_membership, p_emoji);
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_rename_group(p_conversation_id uuid, p_title text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := public.current_profile_id(); clean_title text := left(btrim(p_title), 40);
BEGIN
    IF NOT public.is_current_staff() OR NOT public.dm_is_active_member(p_conversation_id, actor) OR clean_title = '' THEN RAISE EXCEPTION 'rename_not_allowed'; END IF;
    UPDATE public.dm_conversations SET title = clean_title, updated_at = clock_timestamp() WHERE id = p_conversation_id AND kind = 'GROUP';
    IF NOT FOUND THEN RAISE EXCEPTION 'group_required'; END IF;
    INSERT INTO public.dm_messages(conversation_id, sender_id, message_type, content) VALUES (p_conversation_id, actor, 'TITLE_EVENT', '대화방 이름이 ''' || clean_title || '''(으)로 변경되었어요.');
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_mark_read(p_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
    UPDATE public.dm_participant_memberships SET last_read_at = clock_timestamp()
    WHERE conversation_id = p_conversation_id AND user_id = public.current_profile_id() AND left_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_leave_conversation(p_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := public.current_profile_id(); actor_name text; actor_staff boolean := public.is_current_staff(); other_staff integer; student_count integer;
BEGIN
    IF NOT public.dm_is_active_member(p_conversation_id, actor) THEN RAISE EXCEPTION 'membership_required'; END IF;
    SELECT count(*) FILTER (WHERE r.role IN ('admin','master') AND r.enabled), count(*) FILTER (WHERE r.role IS NULL OR NOT r.enabled OR r.role = 'member')
      INTO other_staff, student_count
    FROM public.dm_participant_memberships m LEFT JOIN account_security.account_roles r ON r.profile_id = m.user_id
    WHERE m.conversation_id = p_conversation_id AND m.left_at IS NULL AND m.user_id <> actor;
    IF actor_staff AND other_staff = 0 AND student_count > 0 THEN RAISE EXCEPTION 'last_staff_cannot_leave'; END IF;
    SELECT name INTO actor_name FROM public.users WHERE id = actor;
    UPDATE public.dm_participant_memberships SET left_at = clock_timestamp() WHERE conversation_id = p_conversation_id AND user_id = actor AND left_at IS NULL;
    INSERT INTO public.dm_messages(conversation_id, sender_id, message_type, content) VALUES (p_conversation_id, actor, 'MEMBERSHIP_EVENT', actor_name || ' 님이 대화방에서 나갔어요.');
    IF student_count = 0 THEN UPDATE public.dm_conversations SET status = 'ARCHIVED' WHERE id = p_conversation_id; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_report_conversation(p_conversation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := public.current_profile_id(); result uuid;
BEGIN
    IF NOT public.dm_is_active_member(p_conversation_id, actor) THEN RAISE EXCEPTION 'membership_required'; END IF;
    INSERT INTO public.dm_conversation_reports(conversation_id, reporter_id, message_snapshot, participant_snapshot)
    SELECT p_conversation_id, actor,
      coalesce((SELECT jsonb_agg(row_data ORDER BY created_at) FROM (
        SELECT msg.created_at, jsonb_build_object('id',msg.id,'sender_id',msg.sender_id,'content',coalesce(msg.content,archive.original_content),'created_at',msg.created_at,'revoked_at',msg.revoked_at) row_data
        FROM public.dm_messages msg LEFT JOIN public.dm_message_safety_archive archive ON archive.message_id = msg.id
        WHERE msg.conversation_id = p_conversation_id
          AND msg.created_at >= (SELECT joined_at FROM public.dm_participant_memberships WHERE conversation_id = p_conversation_id AND user_id = actor AND left_at IS NULL LIMIT 1)
        ORDER BY msg.created_at DESC LIMIT 20
      ) recent), '[]'::jsonb),
      coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',m.user_id,'joined_at',m.joined_at)) FROM public.dm_participant_memberships m WHERE m.conversation_id = p_conversation_id AND m.left_at IS NULL), '[]'::jsonb)
    RETURNING id INTO result;
    UPDATE public.dm_message_safety_archive SET expires_at = greatest(expires_at, clock_timestamp() + interval '365 days'), reported_at = clock_timestamp()
    WHERE conversation_id = p_conversation_id AND message_id IN (SELECT id FROM public.dm_messages WHERE conversation_id = p_conversation_id ORDER BY created_at DESC LIMIT 20);
    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.dm_create_direct(uuid), public.dm_create_group(uuid,uuid[],text), public.dm_invite_participant(uuid,uuid), public.dm_send_message(uuid,text), public.dm_revoke_message(bigint), public.dm_toggle_reaction(bigint,text), public.dm_rename_group(uuid,text), public.dm_mark_read(uuid), public.dm_leave_conversation(uuid), public.dm_report_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dm_create_direct(uuid), public.dm_create_group(uuid,uuid[],text), public.dm_invite_participant(uuid,uuid), public.dm_send_message(uuid,text), public.dm_revoke_message(bigint), public.dm_toggle_reaction(bigint,text), public.dm_rename_group(uuid,text), public.dm_mark_read(uuid), public.dm_leave_conversation(uuid), public.dm_report_conversation(uuid) TO authenticated;

-- Realtime publication is idempotent across fresh and linked environments.
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_conversations, public.dm_participant_memberships, public.dm_messages, public.dm_message_reactions, public.dm_typing_states;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
