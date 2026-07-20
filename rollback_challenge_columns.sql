-- 1. 신규 컬럼 제거
ALTER TABLE public.notices DROP COLUMN IF EXISTS is_challenge;
ALTER TABLE public.notices DROP COLUMN IF EXISTS challenge_missions;

-- 2. 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
