-- Qualify the storage object's path inside the user lookup. An unqualified
-- `name` there resolves to users.name and prevents every delete match.
DROP POLICY IF EXISTS community_challenge_image_delete ON storage.objects;
CREATE POLICY community_challenge_image_delete ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'notice-images' AND
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid())
              AND (
                  (split_part(objects.name, '/', 1) = 'mission' AND split_part(objects.name, '/', 2) = u.id::text)
                  OR (split_part(objects.name, '/', 1) = 'challenge-community' AND split_part(objects.name, '/', 3) = u.id::text)
              )
        )
    );
