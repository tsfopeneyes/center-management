ALTER TABLE public.community_channels
ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- A community created independently must survive if a linked program is removed.
ALTER TABLE public.community_channels
DROP CONSTRAINT IF EXISTS community_channels_source_notice_id_fkey;
ALTER TABLE public.community_channels
ADD CONSTRAINT community_channels_source_notice_id_fkey
FOREIGN KEY (source_notice_id) REFERENCES public.notices(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS community_channels_admin_update ON public.community_channels;
CREATE POLICY community_channels_admin_update ON public.community_channels
FOR UPDATE
USING (public.is_community_admin())
WITH CHECK (public.is_community_admin());

DROP POLICY IF EXISTS community_members_read ON public.community_channel_members;
CREATE POLICY community_members_read ON public.community_channel_members
FOR SELECT USING (
    public.is_community_admin()
    OR public.can_access_community_channel(channel_id)
);

DROP POLICY IF EXISTS community_members_admin_insert ON public.community_channel_members;
CREATE POLICY community_members_admin_insert ON public.community_channel_members
FOR INSERT WITH CHECK (public.is_community_admin());

DROP POLICY IF EXISTS community_members_admin_update ON public.community_channel_members;
CREATE POLICY community_members_admin_update ON public.community_channel_members
FOR UPDATE
USING (public.is_community_admin())
WITH CHECK (public.is_community_admin());

DROP POLICY IF EXISTS community_members_admin_delete ON public.community_channel_members;
CREATE POLICY community_members_admin_delete ON public.community_channel_members
FOR DELETE USING (public.is_community_admin());

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

CREATE OR REPLACE FUNCTION public.detach_notice_community_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.community_channels
    SET source_notice_id = NULL,
        channel_type = 'PRIVATE',
        status = 'ACTIVE',
        updated_at = now()
    WHERE source_notice_id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_detach_notice_community_channel ON public.notices;
CREATE TRIGGER trg_detach_notice_community_channel
BEFORE DELETE ON public.notices
FOR EACH ROW EXECUTE FUNCTION public.detach_notice_community_channel();

CREATE OR REPLACE FUNCTION public.link_community_channel_to_notice(
    p_channel_id uuid,
    p_notice_id bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_previous_notice_id bigint;
BEGIN
    IF NOT public.is_community_admin() THEN
        RAISE EXCEPTION '관리자 권한이 필요합니다.' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.community_channels WHERE id = p_channel_id) THEN
        RAISE EXCEPTION '커뮤니티를 찾을 수 없습니다.' USING ERRCODE = '23503';
    END IF;
    IF p_notice_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.notices
        WHERE id = p_notice_id
          AND category = 'PROGRAM'
          AND is_challenge
          AND challenge_format = 'ONLINE'
    ) THEN
        RAISE EXCEPTION '온라인 챌린지 프로그램만 연결할 수 있습니다.' USING ERRCODE = '23514';
    END IF;

    SELECT source_notice_id INTO v_previous_notice_id
    FROM public.community_channels
    WHERE id = p_channel_id;

    IF v_previous_notice_id IS NOT NULL
       AND v_previous_notice_id IS DISTINCT FROM p_notice_id THEN
        UPDATE public.notices
        SET community_enabled = false,
            guest_properties = jsonb_set(COALESCE(guest_properties, '{}'::jsonb), '{community_channel_id}', '""'::jsonb, true)
        WHERE id = v_previous_notice_id;
    END IF;

    IF p_notice_id IS NOT NULL THEN
        UPDATE public.community_channels
        SET source_notice_id = NULL,
            channel_type = 'PRIVATE',
            status = 'ACTIVE',
            updated_at = now()
        WHERE source_notice_id = p_notice_id
          AND id <> p_channel_id;
    END IF;

    UPDATE public.community_channels
    SET source_notice_id = p_notice_id,
        channel_type = CASE WHEN p_notice_id IS NULL THEN 'PRIVATE' ELSE 'CHALLENGE' END,
        status = 'ACTIVE',
        updated_at = now()
    WHERE id = p_channel_id;

    IF p_notice_id IS NOT NULL THEN
        UPDATE public.notices
        SET community_enabled = true,
            guest_properties = jsonb_set(
                COALESCE(guest_properties, '{}'::jsonb),
                '{community_channel_id}',
                to_jsonb(p_channel_id::text),
                true
            )
        WHERE id = p_notice_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.link_community_channel_to_notice(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_community_channel_to_notice(uuid, bigint) TO authenticated;
