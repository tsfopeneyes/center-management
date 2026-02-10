-- 학교 정보 테이블은 그대로 유지하되, 필요한 경우 기존 테이블 삭제 후 재생성 (이미 데이터가 있다면 ALTER 사용 추천)
-- 우선 깨끗한 상태를 위해 DROP IF EXISTS를 사용할 수도 있으나, 데이터 보존을 위해 컬럼 추가 방식 권장

-- 1. 학교 사역 일지 테이블 구조 변경 (기존 테이블이 있다면 삭제 후 재생성하거나 컬럼 추가)
DROP TABLE IF EXISTS public.school_logs;

CREATE TABLE public.school_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time_range TEXT, -- 예: "17:00~18:30"
    participant_ids UUID[] DEFAULT '{}', -- 참여 학생들의 user.id 배열
    location TEXT, -- 장소
    topic TEXT, -- 기존 주제 필드 유지 (선택사항)
    content TEXT, -- 마크다운 내용 (템플릿 적용)
    author_id UUID REFERENCES public.users(id),
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책 재설정
ALTER TABLE public.school_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to school_logs" ON public.school_logs FOR ALL USING (true);
