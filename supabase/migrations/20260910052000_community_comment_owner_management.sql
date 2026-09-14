DROP POLICY IF EXISTS channel_comments_update ON public.community_channel_comments;
CREATE POLICY channel_comments_update ON public.community_channel_comments
FOR UPDATE
USING (
    public.is_current_profile(user_id)
    OR public.is_community_admin()
)
WITH CHECK (
    public.is_current_profile(user_id)
    OR public.is_community_admin()
);

DROP POLICY IF EXISTS channel_comments_delete ON public.community_channel_comments;
CREATE POLICY channel_comments_delete ON public.community_channel_comments
FOR DELETE
USING (
    public.is_current_profile(user_id)
    OR public.is_community_admin()
);
