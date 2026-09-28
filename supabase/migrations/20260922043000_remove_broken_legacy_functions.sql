-- These obsolete functions have no database dependants and no application
-- callers. Their replacements live in the account service and the current
-- community-channel implementation. Exact signatures and no CASCADE keep the
-- removal fail-closed if an unexpected dependency appears later.
BEGIN;

DROP FUNCTION IF EXISTS public.merge_duplicate_users(uuid, uuid);
DROP FUNCTION IF EXISTS public.merge_guest_to_member(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.legacy_login_sync(text, text);
DROP FUNCTION IF EXISTS public.increment_post_comments(uuid);
DROP FUNCTION IF EXISTS public.decrement_post_comments(uuid);
DROP FUNCTION IF EXISTS public.increment_post_likes(uuid);
DROP FUNCTION IF EXISTS public.decrement_post_likes(uuid);

COMMIT;
