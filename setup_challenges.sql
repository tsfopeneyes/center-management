-- 1. Create Challenge Categories Table
CREATE TABLE IF NOT EXISTS public.challenge_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    display_order int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- 2. Create Challenges Table
CREATE TABLE IF NOT EXISTS public.challenges (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id uuid REFERENCES public.challenge_categories(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    image_url text,
    type text NOT NULL, -- 'VISIT', 'PROGRAM', 'SPECIAL'
    threshold int NOT NULL,
    display_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(category_id, name)
);

-- 3. Ensure Columns and Constraints Exist (for existing tables)
DO $$
BEGIN
    -- Add criteria_label if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'challenges' AND column_name = 'criteria_label'
    ) THEN
        ALTER TABLE public.challenges ADD COLUMN criteria_label text;
    END IF;

    -- For challenge_categories unique constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'challenge_categories_name_key'
    ) THEN
        ALTER TABLE public.challenge_categories ADD CONSTRAINT challenge_categories_name_key UNIQUE (name);
    END IF;

    -- For challenges unique constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'challenges_category_id_name_key'
    ) THEN
        ALTER TABLE public.challenges ADD CONSTRAINT challenges_category_id_name_key UNIQUE (category_id, name);
    END IF;
END $$;

-- 4. Enable RLS
ALTER TABLE public.challenge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Read for all, Write for Admin)
-- Drop existing policies first to avoid "already exists" error
DO $$
BEGIN
    DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.challenge_categories;
    DROP POLICY IF EXISTS "Categories are manageable by admins" ON public.challenge_categories;
    DROP POLICY IF EXISTS "Challenges are viewable by everyone" ON public.challenges;
    DROP POLICY IF EXISTS "Challenges are manageable by admins" ON public.challenges;
END $$;

-- Category Policies
CREATE POLICY "Categories are viewable by everyone" ON public.challenge_categories
    FOR SELECT USING (true);

CREATE POLICY "Categories are manageable by admins" ON public.challenge_categories
    FOR ALL USING (true); -- Relaxed for development, allowing management

-- Challenge Policies
CREATE POLICY "Challenges are viewable by everyone" ON public.challenges
    FOR SELECT USING (true);

CREATE POLICY "Challenges are manageable by admins" ON public.challenges
    FOR ALL USING (true); -- Relaxed for development, allowing management

-- 5. Seed Initial Data
-- Categories
INSERT INTO public.challenge_categories (name, display_order) VALUES 
('센터 방문 챌린지', 1),
('프로그램 참여 챌린지', 2),
('특별 트로피', 3)
ON CONFLICT (name) DO NOTHING;

-- Temporary script to link categories and insert challenges
DO $$
DECLARE
    visit_id uuid;
    prog_id uuid;
    special_id uuid;
BEGIN
    SELECT id INTO visit_id FROM challenge_categories WHERE name = '센터 방문 챌린지';
    SELECT id INTO prog_id FROM challenge_categories WHERE name = '프로그램 참여 챌린지';
    SELECT id INTO special_id FROM challenge_categories WHERE name = '특별 트로피';

    -- Visit Challenges
    INSERT INTO public.challenges (category_id, name, description, image_url, type, threshold, criteria_label, display_order) VALUES 
    (visit_id, '첫 만남', '센터에 처음 방문하셨네요!', '/badges/visit_1.png', 'VISIT', 1, '1회 방문', 1),
    (visit_id, '단골 손님', '이제 센터가 익숙하시죠?', '/badges/visit_10.png', 'VISIT', 10, '10회 방문', 2),
    (visit_id, '공간의 주인', '센터의 든든한 일원입니다.', '/badges/visit_30.png', 'VISIT', 30, '30회 방문', 3),
    (visit_id, '센터의 친구', '모두가 당신을 반가워해요.', '/badges/visit_50.png', 'VISIT', 50, '50회 방문', 4),
    (visit_id, '우수 멤버', '당신은 센터의 핵심 멤버입니다.', '/badges/visit_80.png', 'VISIT', 80, '80회 방문', 5),
    (visit_id, '센터의 자랑', '당신은 우리 센터의 보배입니다!', '/badges/visit_100.png', 'VISIT', 100, '100회 방문', 6)
    ON CONFLICT (category_id, name) DO UPDATE SET 
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        threshold = EXCLUDED.threshold,
        criteria_label = EXCLUDED.criteria_label;

    -- Program Challenges
    INSERT INTO public.challenges (category_id, name, description, image_url, type, threshold, criteria_label, display_order) VALUES 
    (prog_id, '첫 참여', '첫 프로그램 참석을 축하합니다!', '/badges/program_1.png', 'PROGRAM', 1, '1회 참여', 1),
    (prog_id, '성장하는 중', '꾸준한 참석이 성장의 지름길!', '/badges/program_5.png', 'PROGRAM', 5, '5회 참여', 2),
    (prog_id, '열정 학생', '누구보다 열정적인 당신!', '/badges/program_10.png', 'PROGRAM', 10, '10회 참여', 3),
    (prog_id, '프로그램 매니아', '센터의 매력에 푹 빠지셨군요.', '/badges/program_20.png', 'PROGRAM', 20, '20회 참여', 4),
    (prog_id, '마스터', '프로그램의 모든 것을 마스터했습니다.', '/badges/program_30.png', 'PROGRAM', 30, '30회 참여', 5)
    ON CONFLICT (category_id, name) DO UPDATE SET 
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        threshold = EXCLUDED.threshold,
        criteria_label = EXCLUDED.criteria_label;

    -- Special Trophies
    INSERT INTO public.challenges (category_id, name, description, image_url, type, threshold, criteria_label, display_order) VALUES 
    (special_id, '벌스데이 로그인', '생일에 센터를 방문하셨네요! 생일 축하합니다!', '/badges/trophy_birthday.png', 'SPECIAL', 1, '생일 방문 완료', 1),
    (special_id, '올 클리어', '모든 공간을 탐험하셨군요! 대단합니다.', '/badges/trophy_allclean.png', 'SPECIAL', 5, '모든 공간 정복', 2),
    (special_id, '하이파이브', '연속 5일 출석 달성! 꾸준함의 승리입니다.', '/badges/trophy_highfive.png', 'SPECIAL', 5, '5일 연속 출석', 3)
    ON CONFLICT (category_id, name) DO UPDATE SET 
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        threshold = EXCLUDED.threshold,
        criteria_label = EXCLUDED.criteria_label;
END $$;
