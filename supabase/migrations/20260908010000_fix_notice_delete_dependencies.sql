-- Notice deletion is initiated by an authenticated administrator. The trigger
-- must be able to hide linked bell notifications even though clients are not
-- allowed to update app_notifications directly.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.hide_notifications_for_deleted_notice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    UPDATE public.app_notifications
    SET is_hidden = true
    WHERE notice_id = OLD.id;
    RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.hide_notifications_for_deleted_notice()
FROM PUBLIC, anon, authenticated;

-- Legacy program_sessions rows are also owned by their source notice and must
-- not prevent an administrator from removing that notice.
ALTER TABLE public.program_sessions
    DROP CONSTRAINT IF EXISTS program_sessions_notice_id_fkey;

ALTER TABLE public.program_sessions
    ADD CONSTRAINT program_sessions_notice_id_fkey
    FOREIGN KEY (notice_id)
    REFERENCES public.notices(id)
    ON DELETE CASCADE;

COMMIT;
