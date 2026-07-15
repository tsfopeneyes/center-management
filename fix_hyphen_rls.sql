-- Supabase SQL Editor에 복사하여 붙여넣고 [Run]을 누르세요!
-- ----------------------------------------------------

-- 1. 기존의 제한적인 policy가 존재한다면 삭제합니다.
DROP POLICY IF EXISTS "Enable all for hyphen_transactions" ON public.hyphen_transactions;

-- 2. 모든 사용자(anon/비인증 포함)가 hyphen_transactions 테이블을 읽고 쓸 수 있도록 RLS 정책을 생성합니다.
CREATE POLICY "Enable all for hyphen_transactions" 
ON public.hyphen_transactions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 3. 혹시 모를 RLS 문제를 원천 차단하기 위해 테이블 RLS를 임시 비활성화합니다.
ALTER TABLE public.hyphen_transactions DISABLE ROW LEVEL SECURITY;

-- 4. Supabase API 서버 캐시 갱신
NOTIFY pgrst, 'reload schema';
