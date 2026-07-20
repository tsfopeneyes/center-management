-- notices 테이블에 '하이픈 등록' 버튼 노출 여부 지정을 위한 컬럼 추가
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS challenge_show_hyphen_btn BOOLEAN DEFAULT FALSE;

-- 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
