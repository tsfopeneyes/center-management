ALTER TABLE public.community_channels
DROP CONSTRAINT IF EXISTS community_channels_status_check;

UPDATE public.community_channels
SET status = 'CLOSED', updated_at = now()
WHERE status = 'READ_ONLY';

ALTER TABLE public.community_channels
ADD CONSTRAINT community_channels_status_check
CHECK (status IN ('SCHEDULED', 'ACTIVE', 'CLOSED', 'ARCHIVED'));
