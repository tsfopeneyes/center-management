-- Replace the legacy online-challenge-only check with the shared program boundary.
-- Existing records, access policies and authentication permissions are unchanged.
BEGIN;
ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_online_community_only;
ALTER TABLE public.notices ADD CONSTRAINT notices_program_community_only
    CHECK (NOT community_enabled OR category = 'PROGRAM') NOT VALID;
ALTER TABLE public.notices VALIDATE CONSTRAINT notices_program_community_only;
COMMIT;
