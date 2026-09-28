-- Wake the shared notification worker immediately when a DM push is queued.
-- A five-minute cron remains as a recovery path for transient failures.
-- Endpoint and bearer secret stay in Vault and never enter migrations or logs.
BEGIN;

CREATE OR REPLACE FUNCTION public.dm_invoke_notification_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    worker_url text;
    worker_secret text;
BEGIN
    SELECT decrypted_secret INTO worker_url
    FROM vault.decrypted_secrets WHERE name = 'dm_push_worker_url';
    SELECT decrypted_secret INTO worker_secret
    FROM vault.decrypted_secrets WHERE name = 'recruitment_alerts_cron_secret';
    IF worker_url IS NULL OR worker_secret IS NULL THEN
        RAISE EXCEPTION 'Notification worker Vault secrets are unavailable';
    END IF;
    PERFORM net.http_post(
        url := worker_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || worker_secret
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dm_invoke_notification_worker() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.dm_wake_notification_worker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM queued_dm_push_rows) THEN
        PERFORM public.dm_invoke_notification_worker();
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.dm_wake_notification_worker() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER dm_wake_notification_worker_after_queue
AFTER INSERT ON public.dm_push_deliveries
REFERENCING NEW TABLE AS queued_dm_push_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.dm_wake_notification_worker();

-- Terminal failures remain distinguishable from intentional skips so their
-- longer diagnostic retention does not retain ordinary delivery metadata.
ALTER TABLE public.dm_push_deliveries
    DROP CONSTRAINT dm_push_deliveries_state_check;
ALTER TABLE public.dm_push_deliveries
    ADD CONSTRAINT dm_push_deliveries_state_check CHECK (
        state IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'DEAD', 'SKIPPED', 'CANCELLED', 'UNCERTAIN')
    );

CREATE OR REPLACE FUNCTION public.dm_purge_expired_push_deliveries()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    removed_count integer;
BEGIN
    DELETE FROM public.dm_push_deliveries
    WHERE (
        state IN ('SENT', 'SKIPPED', 'CANCELLED')
        AND updated_at < clock_timestamp() - interval '7 days'
    ) OR (
        state = 'DEAD'
        AND updated_at < clock_timestamp() - interval '30 days'
    );
    GET DIAGNOSTICS removed_count = ROW_COUNT;
    RETURN removed_count;
END;
$$;
REVOKE ALL ON FUNCTION public.dm_purge_expired_push_deliveries() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'dm_push_worker_url') THEN
        PERFORM vault.create_secret(
            'https://erecqalsxoxrufggvmcc.supabase.co/functions/v1/send-dm-push',
            'dm_push_worker_url',
            'Direct-message push worker URL'
        );
    END IF;
    IF (SELECT count(*) FROM vault.secrets WHERE name IN (
        'dm_push_worker_url', 'recruitment_alerts_cron_secret'
    )) <> 2 THEN
        RAISE EXCEPTION 'Notification worker Vault secrets are unavailable';
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification-delivery-worker') THEN
        PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'notification-delivery-worker'));
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dm-purge-push-deliveries') THEN
        PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'dm-purge-push-deliveries'));
    END IF;

    PERFORM cron.schedule('notification-delivery-worker', '*/5 * * * *', $job$
        SELECT public.dm_invoke_notification_worker();
    $job$);
    PERFORM cron.schedule('dm-purge-push-deliveries', '37 4 * * *', $job$
        SELECT public.dm_purge_expired_push_deliveries();
    $job$);
END;
$$;

COMMIT;
