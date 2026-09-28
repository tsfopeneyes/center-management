-- Add a stable current-school relationship without breaking legacy clients that
-- still read and write users.school. No user, school, or activity rows are deleted.

CREATE OR REPLACE FUNCTION public.normalize_school_key(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT regexp_replace(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(
                            regexp_replace(
                                regexp_replace(coalesce(value, ''), '\s+', '', 'g'),
                                '여자고등학교$', '여고'
                            ),
                            '여자중학교$', '여중'
                        ),
                        '과학고등학교$', '과고'
                    ),
                    '외국어고등학교$', '외고'
                ),
                '고등학교$', '고'
            ),
            '중학교$', '중'
        ),
        '초등학교$', '초'
    );
$$;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS school_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass
          AND conname = 'users_school_id_fkey'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_school_id_fkey
            FOREIGN KEY (school_id)
            REFERENCES public.schools(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_school_id_idx ON public.users(school_id);

-- A school-management delete must never erase operational history. Existing
-- CASCADE constraints are replaced with RESTRICT semantics.
ALTER TABLE public.school_logs DROP CONSTRAINT IF EXISTS school_logs_school_id_fkey;
ALTER TABLE public.school_logs
    ADD CONSTRAINT school_logs_school_id_fkey
    FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE RESTRICT;

ALTER TABLE public.contents DROP CONSTRAINT IF EXISTS contents_school_id_fkey;
ALTER TABLE public.contents
    ADD CONSTRAINT contents_school_id_fkey
    FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE RESTRICT;

ALTER TABLE public.rentals DROP CONSTRAINT IF EXISTS rentals_school_id_fkey;
ALTER TABLE public.rentals
    ADD CONSTRAINT rentals_school_id_fkey
    FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE RESTRICT;

-- Backfill only unambiguous matches. Unknown free-text schools stay untouched
-- and visible while school_id remains NULL for administrator review.
WITH unique_schools AS (
    SELECT min(id::text)::uuid AS id, public.normalize_school_key(name) AS school_key
    FROM public.schools
    WHERE public.normalize_school_key(name) <> ''
    GROUP BY public.normalize_school_key(name)
    HAVING count(*) = 1
)
UPDATE public.users AS target
SET school_id = unique_schools.id
FROM unique_schools
WHERE target.school_id IS NULL
  AND public.normalize_school_key(target.school) = unique_schools.school_key;

CREATE OR REPLACE FUNCTION public.sync_user_school_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    matched_id uuid;
    matched_name text;
BEGIN
    -- New clients may submit the stable id. Keep the legacy display field in
    -- sync so old clients, exports, login candidates, and guest merging work.
    IF NEW.school_id IS DISTINCT FROM OLD.school_id AND NEW.school_id IS NOT NULL THEN
        SELECT name INTO matched_name FROM public.schools WHERE id = NEW.school_id;
        IF matched_name IS NOT NULL THEN
            NEW.school := matched_name;
        END IF;
        RETURN NEW;
    END IF;

    -- Existing clients continue to submit a school name. Resolve only a single
    -- official match; never guess when the school is missing or ambiguous.
    IF TG_OP = 'INSERT' OR NEW.school IS DISTINCT FROM OLD.school THEN
        IF nullif(btrim(coalesce(NEW.school, '')), '') IS NULL THEN
            NEW.school_id := NULL;
            RETURN NEW;
        END IF;

        SELECT min(id::text)::uuid
        INTO matched_id
        FROM public.schools
        WHERE public.normalize_school_key(name) = public.normalize_school_key(NEW.school)
        HAVING count(*) = 1;

        NEW.school_id := matched_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_user_school_reference_trigger ON public.users;
CREATE TRIGGER sync_user_school_reference_trigger
BEFORE INSERT OR UPDATE OF school, school_id ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_school_reference();

-- Keep the existing least-privilege account workers compatible with the new
-- optional field. Existing school text permissions remain unchanged.
GRANT SELECT(school_id) ON public.users TO account_login_worker, account_profile_worker;
GRANT UPDATE(school_id) ON public.users TO account_profile_worker;
GRANT SELECT(id,name) ON public.schools
    TO account_membership_worker, account_profile_worker, account_merge_worker;

COMMENT ON COLUMN public.users.school_id IS
    'Current official school. NULL means no official school has been linked; users.school remains the legacy/free-text fallback.';
