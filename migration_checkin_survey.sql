-- 1. 체크인 설문 응답을 저장할 테이블 생성
CREATE TABLE IF NOT EXISTS checkin_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
    selections TEXT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Row Level Security (RLS) 활성화
ALTER TABLE checkin_surveys ENABLE ROW LEVEL SECURITY;

-- 3. 익명 및 일반 유저의 입실 시 설문 등록(Insert) 허용 정책
CREATE POLICY "Allow anyone to insert checkin surveys" 
ON checkin_surveys 
FOR INSERT 
WITH CHECK (true);

-- 4. 관리자가 설문조사 이력을 조회(Select)할 수 있도록 허용 정책
CREATE POLICY "Allow authenticated users to read checkin surveys" 
ON checkin_surveys 
FOR SELECT 
TO authenticated 
USING (true);
