-- Let authors replace or permanently delete images attached to their own posts.
-- The storage policy is limited to each author's challenge image paths.

DROP POLICY IF EXISTS community_media_update ON public.community_post_media;
CREATE POLICY community_media_update ON public.community_post_media FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.community_channel_posts p
        WHERE p.id = post_id AND p.deleted_at IS NULL
          AND public.is_current_profile(p.author_id)
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.community_channel_posts p
        WHERE p.id = post_id AND p.deleted_at IS NULL
          AND public.is_current_profile(p.author_id)
    ));

DROP POLICY IF EXISTS community_media_delete ON public.community_post_media;
CREATE POLICY community_media_delete ON public.community_post_media FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.community_channel_posts p
        WHERE p.id = post_id AND p.deleted_at IS NULL
          AND public.is_current_profile(p.author_id)
    ));

GRANT UPDATE (media_url) ON public.community_post_media TO authenticated;
GRANT DELETE ON public.community_post_media TO authenticated;

DROP POLICY IF EXISTS community_challenge_image_delete ON storage.objects;
CREATE POLICY community_challenge_image_delete ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'notice-images' AND
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid())
              AND (
                  (split_part(name, '/', 1) = 'mission' AND split_part(name, '/', 2) = u.id::text)
                  OR (split_part(name, '/', 1) = 'challenge-community' AND split_part(name, '/', 3) = u.id::text)
              )
        )
    );

GRANT DELETE ON storage.objects TO authenticated;
