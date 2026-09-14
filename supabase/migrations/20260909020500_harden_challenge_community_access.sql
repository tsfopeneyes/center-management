-- Tighten access before application cutover. This migration is idempotent so
-- it can also be executed directly for immediate policy hardening.

DROP POLICY IF EXISTS offline_submissions_read ON public.offline_challenge_submissions;
CREATE POLICY offline_submissions_read ON public.offline_challenge_submissions FOR SELECT USING (
    public.is_community_admin()
    OR public.is_current_profile(participant_id)
    OR EXISTS (
        SELECT 1 FROM public.notice_responses viewer_response
        JOIN public.users viewer ON viewer.id = viewer_response.user_id
        WHERE viewer_response.notice_id = challenge_id AND viewer_response.status = 'JOIN'
          AND (viewer.id = auth.uid() OR viewer.auth_user_id = auth.uid())
    )
);

DROP POLICY IF EXISTS online_submissions_read ON public.online_challenge_submissions;
CREATE POLICY online_submissions_read ON public.online_challenge_submissions FOR SELECT USING (
    public.is_community_admin()
    OR public.is_current_profile(participant_id)
    OR EXISTS (
        SELECT 1 FROM public.notice_responses viewer_response
        JOIN public.users viewer ON viewer.id = viewer_response.user_id
        WHERE viewer_response.notice_id = challenge_id AND viewer_response.status = 'JOIN'
          AND (viewer.id = auth.uid() OR viewer.auth_user_id = auth.uid())
    )
);

DROP POLICY IF EXISTS channel_posts_insert ON public.community_channel_posts;
CREATE POLICY channel_posts_insert ON public.community_channel_posts FOR INSERT WITH CHECK (
    public.is_current_profile(author_id)
    AND public.can_access_community_channel(channel_id, author_id)
    AND EXISTS (
        SELECT 1 FROM public.community_channels c
        LEFT JOIN public.notices n ON n.id = c.source_notice_id
        WHERE c.id = channel_id AND c.status = 'ACTIVE'
          AND (n.id IS NULL OR n.program_end_date IS NULL
               OR n.program_end_date >= (now() AT TIME ZONE 'Asia/Seoul')::date)
    )
);

CREATE OR REPLACE FUNCTION public.prevent_community_post_identity_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.channel_id IS DISTINCT FROM OLD.channel_id OR NEW.author_id IS DISTINCT FROM OLD.author_id THEN
        RAISE EXCEPTION '게시글의 커뮤니티와 작성자는 변경할 수 없습니다.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_community_post_identity_change ON public.community_channel_posts;
CREATE TRIGGER trg_prevent_community_post_identity_change
BEFORE UPDATE OF channel_id, author_id ON public.community_channel_posts
FOR EACH ROW EXECUTE FUNCTION public.prevent_community_post_identity_change();

