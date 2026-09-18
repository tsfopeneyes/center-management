-- Allow authenticated staff to add participants to daily program sessions.
-- The existing own-row INSERT and staff UPDATE policies remain in place.
BEGIN;

DROP POLICY IF EXISTS daily_session_responses_admin_insert
ON public.daily_program_session_responses;

CREATE POLICY daily_session_responses_admin_insert
ON public.daily_program_session_responses
FOR INSERT TO authenticated
WITH CHECK (public.calendar_is_admin());

COMMIT;
