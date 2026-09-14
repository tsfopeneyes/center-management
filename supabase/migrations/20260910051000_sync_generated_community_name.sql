CREATE OR REPLACE FUNCTION public.sync_notice_community_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_requested_channel_id uuid := NULLIF(NEW.guest_properties->>'community_channel_id', '')::uuid;
BEGIN
    IF NEW.community_enabled
       AND NEW.is_challenge
       AND NEW.challenge_format = 'ONLINE' THEN
        IF v_requested_channel_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.community_channels WHERE id = v_requested_channel_id) THEN
                RAISE EXCEPTION '선택한 커뮤니티를 찾을 수 없습니다.' USING ERRCODE = '23503';
            END IF;
            UPDATE public.community_channels
            SET source_notice_id = NULL, channel_type = 'PRIVATE', status = 'ACTIVE', updated_at = now()
            WHERE source_notice_id = NEW.id AND id <> v_requested_channel_id;
            UPDATE public.community_channels
            SET source_notice_id = NEW.id, channel_type = 'CHALLENGE', status = 'ACTIVE', updated_at = now()
            WHERE id = v_requested_channel_id;
        ELSE
            INSERT INTO public.community_channels(name, channel_type, source_notice_id, status)
            VALUES (NEW.title, 'CHALLENGE', NEW.id, 'ACTIVE')
            ON CONFLICT(source_notice_id) DO UPDATE SET
                name = EXCLUDED.name,
                status = 'ACTIVE',
                channel_type = 'CHALLENGE',
                updated_at = now();
        END IF;
    ELSE
        UPDATE public.community_channels
        SET status = 'CLOSED', updated_at = now()
        WHERE source_notice_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

UPDATE public.community_channels AS channel
SET name = notice.title,
    updated_at = now()
FROM public.notices AS notice
WHERE channel.source_notice_id = notice.id
  AND notice.community_enabled
  AND notice.is_challenge
  AND notice.challenge_format = 'ONLINE'
  AND COALESCE(notice.guest_properties->>'community_channel_id', '') = ''
  AND channel.name IS DISTINCT FROM notice.title;
