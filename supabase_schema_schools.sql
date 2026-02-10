-- 학교 정보 테이블 생성
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL, -- users.school과 매칭되는 학교 이름
    region TEXT, -- 강동 / 강서
    club_type TEXT, -- 자율동아리 / 정규동아리 / 비공식모임
    club_name TEXT,
    manager_ids UUID[] DEFAULT '{}', -- STAFF들의 user.id 배열
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 학교 사역 일지 테이블 생성
CREATE TABLE IF NOT EXISTS public.school_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    topic TEXT,
    content TEXT,
    author_id UUID REFERENCES public.users(id),
    properties JSONB DEFAULT '{}', -- 추가 속성 저장 (노션 스타일)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책 설정 (필요에 따라 오픈하거나 구체화 가능)
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_logs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자에게 조회/수정 권한 부여 (테스트 편의상 혹은 실제 운영 정책에 맞게 조정)
CREATE POLICY "Allow all access to schools" ON public.schools FOR ALL USING (true);
CREATE POLICY "Allow all access to school_logs" ON public.school_logs FOR ALL USING (true);
