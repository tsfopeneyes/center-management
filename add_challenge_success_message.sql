-- notices 테이블에 챌린지 성공 축하 메시지 저장을 위한 컬럼 추가
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS challenge_success_message TEXT DEFAULT '';

-- 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
