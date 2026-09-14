-- Recruitment interests have no meaning after their source program is removed.
-- Keep the rows protected from direct client deletion, but let PostgreSQL clean
-- them up when an administrator deletes the parent notice.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.program_recruitment_interests
    DROP CONSTRAINT IF EXISTS program_recruitment_interests_notice_id_fkey;

ALTER TABLE public.program_recruitment_interests
    ADD CONSTRAINT program_recruitment_interests_notice_id_fkey
    FOREIGN KEY (notice_id)
    REFERENCES public.notices(id)
    ON DELETE CASCADE;

COMMIT;
