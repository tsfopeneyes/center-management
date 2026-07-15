-- Supabase SQL Editor에 복사하여 붙여넣고 [Run]을 누르세요!
-- ----------------------------------------------------

-- 1. 오픈 프로그램 시작일, 종료일, 요일 컬럼 추가
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS program_start_date date;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS program_end_date date;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS program_days integer[] DEFAULT '{}'::integer[];

-- 2. 기존 사용하지 않는 불필요한 컬럼 삭제
ALTER TABLE public.notices DROP COLUMN IF EXISTS challenge_start_date;
ALTER TABLE public.notices DROP COLUMN IF EXISTS challenge_end_date;
ALTER TABLE public.notices DROP COLUMN IF EXISTS challenge_target_date;
ALTER TABLE public.notices DROP COLUMN IF EXISTS challenge_missions;

ALTER TABLE public.notices DROP COLUMN IF EXISTS is_recurring;
ALTER TABLE public.notices DROP COLUMN IF EXISTS recurring_days;
ALTER TABLE public.notices DROP COLUMN IF EXISTS recurring_end_date;

-- 3. Supabase API 서버의 테이블 캐시 즉시 갱신
NOTIFY pgrst, 'reload schema';
