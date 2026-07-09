ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES public.users(id);
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS host_one_liner TEXT;
