-- 1. 학교 정보 테이블에 새로운 컬럼 추가 (데이터 보존)
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS teacher_name TEXT,
ADD COLUMN IF NOT EXISTS meeting_time TEXT;

-- 2. 기존 사역 일지 보존 (이미 v2에서 업데이트됨)
-- 만약 v2 스크립트를 실행하지 않았다면 실행이 필요할 수 있습니다.
