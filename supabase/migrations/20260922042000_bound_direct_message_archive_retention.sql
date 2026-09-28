-- Reports already contain an immutable message snapshot. The separate safety
-- archive therefore needs a bounded lifetime even when a report was filed.
BEGIN;

DROP INDEX IF EXISTS public.dm_safety_archive_expiry;
CREATE INDEX dm_safety_archive_expiry
    ON public.dm_message_safety_archive(expires_at);

CREATE OR REPLACE FUNCTION public.dm_purge_expired_safety_archive()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    DELETE FROM public.dm_message_safety_archive
    WHERE expires_at <= clock_timestamp();
$$;

REVOKE ALL ON FUNCTION public.dm_purge_expired_safety_archive() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dm_purge_expired_safety_archive() TO service_role;

COMMIT;
