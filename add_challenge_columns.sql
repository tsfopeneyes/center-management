-- 1. notices 테이블에 챌린지 여부 및 미션 목록 저장을 위한 컬럼 추가
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS is_challenge BOOLEAN DEFAULT FALSE;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS challenge_missions JSONB DEFAULT '[]'::jsonb;

-- 2. 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
