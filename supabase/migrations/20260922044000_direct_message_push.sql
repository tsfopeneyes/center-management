-- Per-user DM push preferences and a durable, server-owned delivery outbox.
BEGIN;

CREATE TABLE public.dm_push_preferences (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    enabled boolean NOT NULL DEFAULT true,
    preview_enabled boolean NOT NULL DEFAULT false,
    group_enabled boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.dm_push_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dm_push_preferences FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.dm_push_preferences TO authenticated;

CREATE POLICY dm_push_preferences_read_own
ON public.dm_push_preferences FOR SELECT TO authenticated
USING (public.is_current_profile(user_id));

CREATE POLICY dm_push_preferences_insert_own
ON public.dm_push_preferences FOR INSERT TO authenticated
WITH CHECK (public.is_current_profile(user_id));

CREATE POLICY dm_push_preferences_update_own
ON public.dm_push_preferences FOR UPDATE TO authenticated
USING (public.is_current_profile(user_id))
WITH CHECK (public.is_current_profile(user_id));

CREATE TABLE public.dm_push_deliveries (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id bigint NOT NULL REFERENCES public.dm_messages(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED', 'UNCERTAIN')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 20),
    next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    attempt_id uuid,
    device_count integer NOT NULL DEFAULT 0,
    success_count integer NOT NULL DEFAULT 0,
    failure_count integer NOT NULL DEFAULT 0,
    last_error_code text,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(message_id, recipient_id)
);

ALTER TABLE public.dm_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dm_push_deliveries FROM PUBLIC, anon, authenticated;
CREATE INDEX dm_push_deliveries_due
    ON public.dm_push_deliveries(next_attempt_at, id)
    WHERE state IN ('PENDING', 'FAILED');

CREATE OR REPLACE FUNCTION public.dm_queue_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
    IF NEW.message_type <> 'TEXT' OR NEW.revoked_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.dm_push_deliveries(message_id, conversation_id, recipient_id)
    SELECT NEW.id, NEW.conversation_id, membership.user_id
    FROM public.dm_participant_memberships membership
    JOIN public.dm_conversations conversation ON conversation.id = membership.conversation_id
    JOIN public.users recipient ON recipient.id = membership.user_id
    LEFT JOIN public.dm_push_preferences preferences ON preferences.user_id = membership.user_id
    WHERE membership.conversation_id = NEW.conversation_id
      AND membership.left_at IS NULL
      AND membership.user_id IS DISTINCT FROM NEW.sender_id
      AND NEW.created_at >= membership.joined_at
      AND recipient.status IS DISTINCT FROM 'withdrawn'
      AND coalesce(preferences.enabled, true)
      AND (conversation.kind <> 'GROUP' OR coalesce(preferences.group_enabled, true))
      AND (
          membership.joined_as_staff IS FALSE
          OR EXISTS (
              SELECT 1
              FROM account_security.account_roles role
              JOIN account_security.accounts account USING (profile_id)
              WHERE role.profile_id = membership.user_id
                AND role.enabled IS TRUE
                AND role.role IN ('admin', 'master')
                AND account.mapping_verified IS TRUE
                AND account.status = 'active'
          )
      )
    ON CONFLICT (message_id, recipient_id) DO NOTHING;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.dm_queue_message_push() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER dm_queue_message_push_after_insert
AFTER INSERT ON public.dm_messages
FOR EACH ROW EXECUTE FUNCTION public.dm_queue_message_push();

CREATE OR REPLACE FUNCTION public.dm_cancel_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
    IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
        UPDATE public.dm_push_deliveries
        SET state = 'CANCELLED', attempt_id = NULL, updated_at = clock_timestamp(), last_error_code = 'message_revoked'
        WHERE message_id = NEW.id
          AND state IN ('PENDING', 'FAILED');
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.dm_cancel_message_push() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER dm_cancel_message_push_after_revoke
AFTER UPDATE OF revoked_at ON public.dm_messages
FOR EACH ROW EXECUTE FUNCTION public.dm_cancel_message_push();

COMMIT;
