-- Remove the legacy policy that queried the private admin table directly.
-- All admin checks must go through the SECURITY DEFINER helper so a normal
-- participant can evaluate the remaining owner policy without permission errors.

DROP POLICY IF EXISTS channel_posts_admin_update ON public.community_channel_posts;

DROP POLICY IF EXISTS channel_posts_update ON public.community_channel_posts;
CREATE POLICY channel_posts_update ON public.community_channel_posts
FOR UPDATE
USING (
    public.is_current_profile(author_id)
    OR public.is_community_admin()
)
WITH CHECK (
    public.is_current_profile(author_id)
    OR public.is_community_admin()
);
