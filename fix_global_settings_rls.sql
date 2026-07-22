-- Supabase SQL Editor에 복사하여 붙여넣고 [Run]을 누르세요!
-- ----------------------------------------------------

-- 1. global_settings 테이블의 RLS 제한을 해제합니다.
ALTER TABLE public.global_settings DISABLE ROW LEVEL SECURITY;

-- 2. 기존 정책이 있을 경우 삭제 후 전면 허용 정책 생성
DROP POLICY IF EXISTS "Enable all for global_settings" ON public.global_settings;

CREATE POLICY "Enable all for global_settings" 
ON public.global_settings 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 3. Supabase API 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';
