-- 1. notices 테이블에서 기존 챌린지 관련 컬럼 삭제
ALTER TABLE public.notices DROP COLUMN IF EXISTS challenge_start_date;
ALTER TABLE public.notices DROP COLUMN IF EXISTS challenge_end_date;
ALTER TABLE public.notices DROP COLUMN IF EXISTS challenge_target_date;
ALTER TABLE public.notices DROP COLUMN IF EXISTS challenge_missions;

-- 2. 오픈 프로그램 진행 기간 및 요일을 위한 신규 컬럼 추가
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS program_start_date DATE;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS program_end_date DATE;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS program_days INTEGER[] DEFAULT '{}';

-- 3. 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
