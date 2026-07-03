-- SQL Migration: 챌린지 프로그램 및 미션 상태 관리를 위한 컬럼 추가

-- 1. notices 테이블에 챌린지 전용 설정 컬럼 추가
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS challenge_start_date TIMESTAMPTZ;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS challenge_end_date TIMESTAMPTZ;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS challenge_target_date TIMESTAMPTZ;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS challenge_missions JSONB DEFAULT '[]'::jsonb;

-- 2. notice_responses 테이블에 학생별 챌린지 개별 미션 완료 상태 및 사진 URL 기록용 컬럼 추가
ALTER TABLE public.notice_responses ADD COLUMN IF NOT EXISTS challenge_mission_statuses JSONB DEFAULT '{}'::jsonb;

-- 3. 기존 카테고리 외에 'CHALLENGE' 형태를 지원할 수 있도록 필요한 설명 주석
COMMENT ON COLUMN public.notices.category IS 'PROGRAM | NOTICE (또는 내부 구분용)';
COMMENT ON COLUMN public.notices.program_type IS 'CENTER | KIOSK | CHALLENGE';
