-- 1. contents 테이블 생성 (간식, 보드게임 등)
CREATE TABLE IF NOT EXISTS public.contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- '간식', '보드게임' 등
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS 활성화
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능 정책
CREATE POLICY "Allow public read access on contents" 
ON public.contents FOR SELECT USING (true);

-- 관리자만 삽입/수정/삭제 정책
CREATE POLICY "Allow admin write access on contents" 
ON public.contents FOR ALL USING (true);


-- 2. rentals 테이블 생성 (공간 대여)
CREATE TABLE IF NOT EXISTS public.rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS 활성화
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능 정책
CREATE POLICY "Allow public read access on rentals" 
ON public.rentals FOR SELECT USING (true);

-- 관리자만 삽입/수정/삭제 정책
CREATE POLICY "Allow admin write access on rentals" 
ON public.rentals FOR ALL USING (true);


-- 3. rental_bookings 테이블 생성 (예약 및 신청)
CREATE TABLE IF NOT EXISTS public.rental_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    booking_date DATE NOT NULL,
    start_time TEXT NOT NULL, -- '10:00'
    end_time TEXT NOT NULL,   -- '12:00'
    status TEXT DEFAULT 'PENDING' NOT NULL, -- 'PENDING', 'APPROVED', 'REJECTED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS 활성화
ALTER TABLE public.rental_bookings ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능 정책
CREATE POLICY "Allow public read access on rental_bookings" 
ON public.rental_bookings FOR SELECT USING (true);

-- 누구나 신청 가능 정책
CREATE POLICY "Allow user insert access on rental_bookings" 
ON public.rental_bookings FOR INSERT WITH CHECK (true);

-- 본인 및 관리자 수정/삭제 정책
CREATE POLICY "Allow users/admins modification access on rental_bookings" 
ON public.rental_bookings FOR ALL USING (true);


-- 4. 하이픈 공간 기본값 추가
-- 강동 학교 ID 조회 후 추가
DO $$
DECLARE
    gangdong_id UUID;
    hyphen_id UUID;
BEGIN
    SELECT id INTO gangdong_id FROM public.schools WHERE name = '강동' LIMIT 1;
    
    -- 없을 경우 임시로 강동 생성
    IF gangdong_id IS NULL THEN
        INSERT INTO public.schools (name, region) VALUES ('강동', '강동') RETURNING id INTO gangdong_id;
    END IF;
    
    -- 하이픈 공간 삽입
    INSERT INTO public.rentals (school_id, name) VALUES 
    (gangdong_id, '4F CONNECT 1'),
    (gangdong_id, '4F CONNECT 2'),
    (gangdong_id, '4F CONNECT 3'),
    (gangdong_id, '4F CONNECT ROOM'),
    (gangdong_id, 'B1F STAGE')
    ON CONFLICT DO NOTHING;
END $$;
