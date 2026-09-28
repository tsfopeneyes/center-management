-- Promote school names already used by active youth records into canonical
-- school rows. Their district is intentionally left unassigned until an
-- administrator classifies them.
WITH target_schools(name) AS (
    VALUES
        ('경민IT고등학교'::text),
        ('덕계고등학교'::text),
        ('성동고등학교'::text),
        ('조슈아 홈스쿨 아카데미'::text),
        ('중경고등학교'::text)
)
INSERT INTO public.schools (name, region)
SELECT target.name, NULL
FROM target_schools target
WHERE NOT EXISTS (
    SELECT 1
    FROM public.schools school
    WHERE public.normalize_school_key(school.name) = public.normalize_school_key(target.name)
)
ON CONFLICT (name) DO NOTHING;

WITH target_schools(name) AS (
    VALUES
        ('경민IT고등학교'::text),
        ('덕계고등학교'::text),
        ('성동고등학교'::text),
        ('조슈아 홈스쿨 아카데미'::text),
        ('중경고등학교'::text)
)
UPDATE public.users member
SET school_id = school.id
FROM target_schools target
JOIN public.schools school
  ON public.normalize_school_key(school.name) = public.normalize_school_key(target.name)
WHERE member.school_id IS NULL
  AND member.user_group = '청소년'
  AND public.normalize_school_key(member.school) = public.normalize_school_key(target.name);

DO $$
DECLARE
    unresolved_count integer;
BEGIN
    SELECT count(*)
    INTO unresolved_count
    FROM public.users member
    WHERE member.user_group = '청소년'
      AND member.school_id IS NULL
      AND public.normalize_school_key(member.school) = ANY (ARRAY[
          public.normalize_school_key('경민IT고등학교'),
          public.normalize_school_key('덕계고등학교'),
          public.normalize_school_key('성동고등학교'),
          public.normalize_school_key('조슈아 홈스쿨 아카데미'),
          public.normalize_school_key('중경고등학교')
      ]);

    IF unresolved_count <> 0 THEN
        RAISE EXCEPTION 'Failed to link % target youth school records', unresolved_count;
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
