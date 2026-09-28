BEGIN;

GRANT UPDATE(user_id), DELETE ON public.program_push_recipients TO account_merge_worker;

DROP POLICY IF EXISTS account_merge_program_push_recipients
ON public.program_push_recipients;
CREATE POLICY account_merge_program_push_recipients
ON public.program_push_recipients
FOR UPDATE
TO account_merge_worker
USING (user_id = NULLIF(current_setting('app.merge_source_id', true), '')::uuid)
WITH CHECK (user_id = NULLIF(current_setting('app.merge_target_id', true), '')::uuid);

DROP POLICY IF EXISTS account_merge_delete_duplicate_program_push_recipient
ON public.program_push_recipients;
CREATE POLICY account_merge_delete_duplicate_program_push_recipient
ON public.program_push_recipients
FOR DELETE
TO account_merge_worker
USING (user_id = NULLIF(current_setting('app.merge_source_id', true), '')::uuid);

COMMIT;
