-- Human-readable public survey addresses while preserving every existing UUID link.
BEGIN;

ALTER TABLE public.survey_links
  ADD COLUMN IF NOT EXISTS public_slug text;

ALTER TABLE public.survey_links
  DROP CONSTRAINT IF EXISTS survey_links_public_slug_format;
ALTER TABLE public.survey_links
  ADD CONSTRAINT survey_links_public_slug_format CHECK (
    public_slug IS NULL
    OR public_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS survey_public_slug_unique
  ON public.survey_links(public_slug)
  WHERE public_slug IS NOT NULL;

ALTER TABLE public.survey_links
  DROP CONSTRAINT IF EXISTS survey_links_target_check;
ALTER TABLE public.survey_links
  ADD CONSTRAINT survey_links_target_check CHECK (
    (event = 'PROGRAM' AND notice_id IS NOT NULL AND center_code IS NULL AND public_token IS NULL AND public_slug IS NULL AND frequency = 'ONCE') OR
    (event IN ('CHECKIN','CHECKOUT') AND notice_id IS NULL AND center_code IS NOT NULL AND public_token IS NULL AND public_slug IS NULL) OR
    (event = 'PUBLIC' AND notice_id IS NULL AND center_code IS NULL AND num_nonnulls(public_token, public_slug) = 1 AND frequency = 'ONCE')
  );

COMMIT;
