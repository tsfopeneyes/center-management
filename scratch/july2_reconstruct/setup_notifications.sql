-- Notifications Table
CREATE TABLE IF NOT EXISTS public.app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    target_group VARCHAR(50) NOT NULL, -- '전체', '청소년', '졸업생', 'STAFF' 등
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tracking which users have read which notifications
CREATE TABLE IF NOT EXISTS public.user_notification_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES public.app_notifications(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, notification_id)
);

-- RLS (Row Level Security)
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can select app_notifications" ON public.app_notifications;
CREATE POLICY "Anyone can select app_notifications" 
ON public.app_notifications FOR SELECT 
USING (true);
DROP POLICY IF EXISTS "Anyone can insert app_notifications" ON public.app_notifications;
CREATE POLICY "Anyone can insert app_notifications" 
ON public.app_notifications FOR INSERT 
WITH CHECK (true);

ALTER TABLE public.user_notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own reads" ON public.user_notification_reads;
CREATE POLICY "Users can manage their own reads" 
ON public.user_notification_reads FOR ALL 
USING (true) 
WITH CHECK (true);
