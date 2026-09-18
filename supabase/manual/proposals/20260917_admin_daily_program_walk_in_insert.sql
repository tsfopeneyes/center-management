-- Reviewed proposal; apply to production only after explicit approval.
-- Impact: authenticated staff may insert a response for a participant through
-- the existing manual attendance flow. The existing own-row INSERT policy and
-- admin UPDATE policy remain unchanged. No existing rows are modified.
BEGIN;

CREATE POLICY daily_session_responses_admin_insert
ON public.daily_program_session_responses
FOR INSERT TO authenticated
WITH CHECK (public.calendar_is_admin());

COMMIT;
