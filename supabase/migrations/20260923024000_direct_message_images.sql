-- Private image messages. Objects are never public; current eligible message
-- readers receive short-lived signed URLs from Storage.
BEGIN;

ALTER TABLE public.dm_messages
    ADD COLUMN media_path text,
    ADD COLUMN media_mime text;

ALTER TABLE public.dm_messages DROP CONSTRAINT dm_messages_message_type_check;
ALTER TABLE public.dm_messages DROP CONSTRAINT dm_messages_check;
ALTER TABLE public.dm_messages ADD CONSTRAINT dm_messages_message_type_check
    CHECK (message_type IN ('TEXT', 'IMAGE', 'MEMBERSHIP_EVENT', 'TITLE_EVENT'));
ALTER TABLE public.dm_messages ADD CONSTRAINT dm_messages_content_check CHECK (
    (message_type = 'TEXT' AND ((revoked_at IS NULL AND length(btrim(content)) BETWEEN 1 AND 2000) OR (revoked_at IS NOT NULL AND content IS NULL)))
    OR (message_type = 'IMAGE' AND media_path IS NOT NULL AND media_mime IN ('image/jpeg','image/png','image/webp','image/gif') AND (content IS NULL OR length(btrim(content)) BETWEEN 1 AND 500))
    OR (message_type IN ('MEMBERSHIP_EVENT','TITLE_EVENT') AND revoked_at IS NULL AND length(btrim(content)) BETWEEN 1 AND 500)
);

ALTER TABLE public.dm_message_safety_archive
    ALTER COLUMN original_content DROP NOT NULL,
    ADD COLUMN original_media_path text;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dm-media', 'dm-media', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public=false, file_size_limit=10485760,
    allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/gif'];

GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;
DROP POLICY IF EXISTS dm_media_insert ON storage.objects;
DROP POLICY IF EXISTS dm_media_read ON storage.objects;
DROP POLICY IF EXISTS dm_media_delete_unattached ON storage.objects;
CREATE POLICY dm_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'dm-media' AND (storage.foldername(name))[1] = public.current_profile_id()::text
);
CREATE POLICY dm_media_read ON storage.objects FOR SELECT TO authenticated USING (
    bucket_id = 'dm-media' AND EXISTS (
        SELECT 1 FROM public.dm_messages message
        WHERE message.media_path = name AND message.revoked_at IS NULL
          AND public.dm_can_read_message(message.id)
    )
);
CREATE POLICY dm_media_delete_unattached ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'dm-media' AND (storage.foldername(name))[1] = public.current_profile_id()::text
      AND NOT EXISTS (SELECT 1 FROM public.dm_messages message WHERE message.media_path = name)
);

DROP POLICY dm_messages_insert ON public.dm_messages;
CREATE POLICY dm_messages_insert ON public.dm_messages FOR INSERT TO authenticated WITH CHECK (
    message_type IN ('TEXT','IMAGE') AND sender_id = public.current_profile_id()
    AND public.dm_is_active_member(conversation_id)
    AND EXISTS (SELECT 1 FROM public.dm_conversations c WHERE c.id = conversation_id AND c.status = 'ACTIVE')
    AND (message_type <> 'IMAGE' OR media_path LIKE public.current_profile_id()::text || '/%')
);

CREATE OR REPLACE FUNCTION public.dm_send_image(p_conversation_id uuid, p_media_path text, p_media_mime text)
RETURNS public.dm_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := public.current_profile_id(); result public.dm_messages;
BEGIN
    IF NOT public.dm_is_active_member(p_conversation_id, actor)
       OR p_media_path NOT LIKE actor::text || '/%'
       OR p_media_mime NOT IN ('image/jpeg','image/png','image/webp','image/gif') THEN
        RAISE EXCEPTION 'invalid_image_message';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.dm_conversations WHERE id=p_conversation_id AND status='ACTIVE') THEN RAISE EXCEPTION 'conversation_unavailable'; END IF;
    INSERT INTO public.dm_messages(conversation_id,sender_id,message_type,media_path,media_mime)
    VALUES (p_conversation_id,actor,'IMAGE',p_media_path,p_media_mime) RETURNING * INTO result;
    UPDATE public.dm_conversations SET updated_at=result.created_at,last_message_at=result.created_at WHERE id=p_conversation_id;
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_start_image_conversation(p_recipient_ids uuid[], p_media_path text, p_media_mime text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := public.current_profile_id(); recipients uuid[]; recipient_count integer; result uuid;
BEGIN
    SELECT coalesce(array_agg(DISTINCT recipient),ARRAY[]::uuid[]) INTO recipients
    FROM unnest(coalesce(p_recipient_ids,ARRAY[]::uuid[])) recipient
    WHERE recipient IS NOT NULL AND recipient <> actor;
    recipient_count := cardinality(recipients);
    IF actor IS NULL OR recipient_count=0 THEN RAISE EXCEPTION 'invalid_conversation_start'; END IF;
    IF recipient_count=1 THEN
        result := public.dm_create_direct(recipients[1]);
    ELSE
        IF NOT public.is_current_staff() THEN RAISE EXCEPTION 'staff_required_for_group'; END IF;
        IF (SELECT count(*) FROM account_security.accounts account JOIN public.users users ON users.id=account.profile_id
            WHERE account.profile_id=ANY(recipients) AND account.mapping_verified AND account.status='active'
              AND users.status IS DISTINCT FROM 'withdrawn') <> recipient_count THEN RAISE EXCEPTION 'inactive_participant'; END IF;
        INSERT INTO public.dm_conversations(kind,created_by) VALUES ('GROUP',actor) RETURNING id INTO result;
        INSERT INTO public.dm_participant_memberships(conversation_id,user_id,invited_by) VALUES (result,actor,actor);
        INSERT INTO public.dm_participant_memberships(conversation_id,user_id,invited_by)
        SELECT result,recipient,actor FROM unnest(recipients) recipient;
    END IF;
    PERFORM public.dm_send_image(result,p_media_path,p_media_mime);
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_revoke_message(p_message_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := public.current_profile_id(); source public.dm_messages;
BEGIN
    SELECT * INTO source FROM public.dm_messages WHERE id=p_message_id FOR UPDATE;
    IF source.sender_id<>actor OR source.message_type NOT IN ('TEXT','IMAGE') OR source.revoked_at IS NOT NULL
       OR source.created_at<clock_timestamp()-interval '10 minutes' OR NOT public.dm_is_active_member(source.conversation_id,actor) THEN RAISE EXCEPTION 'message_cannot_be_revoked'; END IF;
    INSERT INTO public.dm_message_safety_archive(message_id,conversation_id,sender_id,original_content,original_media_path,sent_at)
    VALUES (source.id,source.conversation_id,actor,source.content,source.media_path,source.created_at);
    DELETE FROM public.dm_message_reactions WHERE message_id=source.id;
    UPDATE public.dm_messages SET content=NULL,revoked_at=clock_timestamp(),revoked_by=actor WHERE id=source.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_queue_message_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
    IF NEW.message_type NOT IN ('TEXT','IMAGE') OR NEW.revoked_at IS NOT NULL THEN RETURN NEW; END IF;
    INSERT INTO public.dm_push_deliveries(message_id,conversation_id,recipient_id)
    SELECT NEW.id,NEW.conversation_id,membership.user_id
    FROM public.dm_participant_memberships membership
    JOIN public.dm_conversations conversation ON conversation.id=membership.conversation_id
    JOIN public.users recipient ON recipient.id=membership.user_id
    LEFT JOIN public.dm_push_preferences preferences ON preferences.user_id=membership.user_id
    WHERE membership.conversation_id=NEW.conversation_id AND membership.left_at IS NULL
      AND membership.user_id IS DISTINCT FROM NEW.sender_id AND NEW.created_at>=membership.joined_at
      AND recipient.status IS DISTINCT FROM 'withdrawn' AND coalesce(preferences.enabled,true)
      AND (conversation.kind<>'GROUP' OR coalesce(preferences.group_enabled,true))
      AND (membership.joined_as_staff IS FALSE OR EXISTS (
          SELECT 1 FROM account_security.account_roles role JOIN account_security.accounts account USING(profile_id)
          WHERE role.profile_id=membership.user_id AND role.enabled AND role.role IN ('admin','master')
            AND account.mapping_verified AND account.status='active'))
    ON CONFLICT(message_id,recipient_id) DO NOTHING;
    RETURN NEW;
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
        SELECT msg.created_at, jsonb_build_object(
          'id',msg.id,'sender_id',msg.sender_id,'message_type',msg.message_type,
          'content',coalesce(msg.content,archive.original_content),
          'media_path',coalesce(msg.media_path,archive.original_media_path),
          'created_at',msg.created_at,'revoked_at',msg.revoked_at
        ) row_data
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

REVOKE ALL ON FUNCTION public.dm_send_image(uuid,text,text), public.dm_start_image_conversation(uuid[],text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dm_send_image(uuid,text,text), public.dm_start_image_conversation(uuid[],text,text) TO authenticated,service_role;

COMMIT;
