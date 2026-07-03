-- 1. Create location_groups table
CREATE TABLE IF NOT EXISTS public.location_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS and create policy for frontend access
ALTER TABLE public.location_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for location_groups" ON public.location_groups;
CREATE POLICY "Enable all for location_groups" ON public.location_groups FOR ALL USING (true) WITH CHECK (true);

-- 3. Insert default groups
INSERT INTO public.location_groups (name) 
VALUES ('하이픈'), ('이높플레이스') 
ON CONFLICT (name) DO NOTHING;

-- 4. Add group_id to locations
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.location_groups(id);

-- 5. Assign existing locations to groups based on names (best effort mapping)
UPDATE public.locations 
SET group_id = (SELECT id FROM public.location_groups WHERE name = '하이픈')
WHERE name ILIKE '%라운지%' 
   OR name ILIKE '%워크숍룸%' 
   OR name ILIKE '%회의실%' 
   OR name ILIKE '%고백%' 
   OR name ILIKE '%멤버십%' 
   OR name ILIKE '%맴버쉽%'
   OR name ILIKE '%하이픈%';

UPDATE public.locations 
SET group_id = (SELECT id FROM public.location_groups WHERE name = '이높플레이스')
WHERE name ILIKE '%이높플레이스%';
