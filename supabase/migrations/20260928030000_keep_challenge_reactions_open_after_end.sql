-- Keep post reactions available in an online challenge community after its
-- mission period. Channel membership and post visibility still apply.

BEGIN;

DROP POLICY IF EXISTS channel_reactions_write ON public.community_channel_reactions;

CREATE POLICY channel_reactions_write
ON public.community_channel_reactions
FOR ALL
TO authenticated
USING (
    public.is_current_profile(user_id)
    OR public.is_community_admin()
)
WITH CHECK (
    public.is_current_profile(user_id)
    AND public.can_access_community_channel((
        SELECT post.channel_id
        FROM public.community_channel_posts post
        WHERE post.id = post_id
          AND post.deleted_at IS NULL
          AND NOT post.is_hidden
    ), user_id)
);

COMMIT;

NOTIFY pgrst, 'reload schema';
