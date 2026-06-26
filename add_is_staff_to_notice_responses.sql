-- notice_responses 테이블에 스탭 여부(is_staff) 컬럼 추가
ALTER TABLE public.notice_responses ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT false;
