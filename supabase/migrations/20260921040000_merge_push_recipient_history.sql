BEGIN;

-- Recipient history is a set keyed by dispatch and user. If both the guest and
-- formal account received the same dispatch, keep the formal account row only.
-- Other guest recipient rows are relinked to the formal account.
GRANT UPDATE(user_id), DELETE ON public.push_dispatch_recipients TO account_merge_worker;

DROP POLICY IF EXISTS account_merge_push_dispatch_recipients
ON public.push_dispatch_recipients;
CREATE POLICY account_merge_push_dispatch_recipients
ON public.push_dispatch_recipients
FOR UPDATE
TO account_merge_worker
USING (user_id = NULLIF(current_setting('app.merge_source_id', true), '')::uuid)
WITH CHECK (user_id = NULLIF(current_setting('app.merge_target_id', true), '')::uuid);

DROP POLICY IF EXISTS account_merge_delete_duplicate_push_recipient
ON public.push_dispatch_recipients;
CREATE POLICY account_merge_delete_duplicate_push_recipient
ON public.push_dispatch_recipients
FOR DELETE
TO account_merge_worker
USING (user_id = NULLIF(current_setting('app.merge_source_id', true), '')::uuid);

COMMIT;
