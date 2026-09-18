-- Announcements stay above the ordinary feed. Per-account read cursors mark
-- the boundary between newly published posts and posts seen on a prior visit.

ALTER TABLE public.community_channel_posts
    ADD COLUMN IF NOT EXISTS is_announcement boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS announced_at timestamptz;

CREATE INDEX IF NOT EXISTS community_announcements_feed_idx
    ON public.community_channel_posts(channel_id, announced_at DESC)
    WHERE is_announcement AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.guard_community_announcement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_announcement AND NOT public.is_current_staff() THEN
            RAISE EXCEPTION '관리자만 공지 글을 등록할 수 있습니다.' USING ERRCODE = '42501';
        END IF;
        NEW.announced_at := CASE WHEN NEW.is_announcement THEN now() ELSE NULL END;
    ELSE
        IF NEW.is_announcement IS DISTINCT FROM OLD.is_announcement
           AND NOT public.is_current_staff() THEN
            RAISE EXCEPTION '관리자만 공지 상태를 변경할 수 있습니다.' USING ERRCODE = '42501';
        END IF;
        NEW.announced_at := CASE
            WHEN NOT NEW.is_announcement THEN NULL
            WHEN OLD.is_announcement THEN OLD.announced_at
            ELSE now()
        END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_community_announcement ON public.community_channel_posts;
CREATE TRIGGER trg_guard_community_announcement
BEFORE INSERT OR UPDATE OF is_announcement, announced_at
ON public.community_channel_posts
FOR EACH ROW EXECUTE FUNCTION public.guard_community_announcement();

CREATE OR REPLACE FUNCTION public.create_online_challenge_announcement(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_post_id uuid;
BEGIN
    IF NOT public.is_current_staff() THEN
        RAISE EXCEPTION '관리자만 공지 글을 등록할 수 있습니다.' USING ERRCODE = '42501';
    END IF;
    v_post_id := public.create_online_challenge_post(p_payload);
    UPDATE public.community_channel_posts
    SET is_announcement = true
    WHERE id = v_post_id;
    RETURN v_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_online_challenge_announcement(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_online_challenge_announcement(jsonb) TO authenticated;

CREATE TABLE IF NOT EXISTS public.community_channel_read_cursors (
    channel_id uuid NOT NULL REFERENCES public.community_channels(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    last_read_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (channel_id, user_id)
);

ALTER TABLE public.community_channel_read_cursors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_read_cursors_select ON public.community_channel_read_cursors;
CREATE POLICY community_read_cursors_select ON public.community_channel_read_cursors
FOR SELECT TO authenticated USING (public.is_current_profile(user_id)
    AND public.can_access_community_channel(channel_id));
DROP POLICY IF EXISTS community_read_cursors_insert ON public.community_channel_read_cursors;
CREATE POLICY community_read_cursors_insert ON public.community_channel_read_cursors
FOR INSERT TO authenticated WITH CHECK (public.is_current_profile(user_id)
    AND public.can_access_community_channel(channel_id));
DROP POLICY IF EXISTS community_read_cursors_update ON public.community_channel_read_cursors;
CREATE POLICY community_read_cursors_update ON public.community_channel_read_cursors
FOR UPDATE TO authenticated USING (public.is_current_profile(user_id)
    AND public.can_access_community_channel(channel_id))
WITH CHECK (public.is_current_profile(user_id)
    AND public.can_access_community_channel(channel_id));

GRANT SELECT, INSERT, UPDATE ON public.community_channel_read_cursors TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_community_channel_read(
    p_channel_id uuid, p_user_id uuid, p_read_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_current_profile(p_user_id)
       OR NOT public.can_access_community_channel(p_channel_id) THEN
        RAISE EXCEPTION '커뮤니티 읽음 상태를 저장할 수 없습니다.' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.community_channel_read_cursors(channel_id, user_id, last_read_at)
    VALUES (p_channel_id, p_user_id, LEAST(p_read_at, now()))
    ON CONFLICT (channel_id, user_id) DO UPDATE
    SET last_read_at = GREATEST(public.community_channel_read_cursors.last_read_at, EXCLUDED.last_read_at),
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_community_channel_read(uuid, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_community_channel_read(uuid, uuid, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
