-- Preserve the role under which a participant joined so a former staff
-- account cannot regain an old staff conversation after being downgraded.
-- Also enforce automatic expiry for unreported revoked-message originals.
BEGIN;

ALTER TABLE public.dm_participant_memberships
    ADD COLUMN joined_as_staff boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.dm_set_membership_role_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
    NEW.joined_as_staff := EXISTS (
        SELECT 1
        FROM account_security.account_roles r
        JOIN account_security.accounts a USING (profile_id)
        JOIN public.users u ON u.id = r.profile_id
        WHERE r.profile_id = NEW.user_id
          AND r.enabled IS TRUE
          AND r.role IN ('admin', 'master')
          AND a.mapping_verified IS TRUE
          AND a.status = 'active'
          AND u.status IS DISTINCT FROM 'withdrawn'
    );
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.dm_set_membership_role_snapshot() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER dm_snapshot_membership_role_before_insert
BEFORE INSERT ON public.dm_participant_memberships
FOR EACH ROW EXECUTE FUNCTION public.dm_set_membership_role_snapshot();

-- This update is safe for installations where conversations were created
-- between the initial migration and this hardening migration.
UPDATE public.dm_participant_memberships m
SET joined_as_staff = EXISTS (
    SELECT 1
    FROM account_security.account_roles r
    JOIN account_security.accounts a USING (profile_id)
    JOIN public.users u ON u.id = r.profile_id
    WHERE r.profile_id = m.user_id
      AND r.enabled IS TRUE
      AND r.role IN ('admin', 'master')
      AND a.mapping_verified IS TRUE
      AND a.status = 'active'
      AND u.status IS DISTINCT FROM 'withdrawn'
);

CREATE OR REPLACE FUNCTION public.dm_is_active_member(
    p_conversation_id uuid,
    p_profile_id uuid DEFAULT public.current_profile_id()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.dm_participant_memberships m
        JOIN public.users u ON u.id = m.user_id
        WHERE m.conversation_id = p_conversation_id
          AND m.user_id = p_profile_id
          AND m.left_at IS NULL
          AND u.status IS DISTINCT FROM 'withdrawn'
          AND (
              m.joined_as_staff IS FALSE
              OR EXISTS (
                  SELECT 1
                  FROM account_security.account_roles r
                  JOIN account_security.accounts a USING (profile_id)
                  WHERE r.profile_id = p_profile_id
                    AND r.enabled IS TRUE
                    AND r.role IN ('admin', 'master')
                    AND a.mapping_verified IS TRUE
                    AND a.status = 'active'
              )
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.dm_can_read_message(
    p_message_id bigint,
    p_profile_id uuid DEFAULT public.current_profile_id()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.dm_messages msg
        JOIN public.dm_participant_memberships m ON m.conversation_id = msg.conversation_id
        JOIN public.users u ON u.id = m.user_id
        WHERE msg.id = p_message_id
          AND m.user_id = p_profile_id
          AND m.left_at IS NULL
          AND msg.created_at >= m.joined_at
          AND u.status IS DISTINCT FROM 'withdrawn'
          AND (
              m.joined_as_staff IS FALSE
              OR EXISTS (
                  SELECT 1
                  FROM account_security.account_roles r
                  JOIN account_security.accounts a USING (profile_id)
                  WHERE r.profile_id = p_profile_id
                    AND r.enabled IS TRUE
                    AND r.role IN ('admin', 'master')
                    AND a.mapping_verified IS TRUE
                    AND a.status = 'active'
              )
          )
    );
$$;

CREATE INDEX dm_safety_archive_expiry
    ON public.dm_message_safety_archive(expires_at)
    WHERE reported_at IS NULL;

CREATE OR REPLACE FUNCTION public.dm_purge_expired_safety_archive()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    DELETE FROM public.dm_message_safety_archive
    WHERE reported_at IS NULL
      AND expires_at <= clock_timestamp();
$$;

REVOKE ALL ON FUNCTION public.dm_purge_expired_safety_archive() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dm_purge_expired_safety_archive() TO service_role;

DO $$
DECLARE
    existing_job bigint;
BEGIN
    SELECT jobid INTO existing_job
    FROM cron.job
    WHERE jobname = 'dm-purge-expired-safety-archive';

    IF existing_job IS NOT NULL THEN
        PERFORM cron.unschedule(existing_job);
    END IF;

    PERFORM cron.schedule(
        'dm-purge-expired-safety-archive',
        '17 3 * * *',
        'SELECT public.dm_purge_expired_safety_archive()'
    );
END;
$$;

COMMIT;
