-- Keep deleted posts invisible to everyone. The function checks ownership before
-- updating, and runs with table-owner privileges so UPDATE does not need to make
-- the deleted row visible to the caller's SELECT policy.
CREATE OR REPLACE FUNCTION public.soft_delete_community_post(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_author_id uuid;
    v_deleted_at timestamptz;
BEGIN
    SELECT author_id, deleted_at INTO v_author_id, v_deleted_at
    FROM public.community_channel_posts
    WHERE id = p_post_id
    FOR UPDATE;

    IF NOT FOUND OR v_deleted_at IS NOT NULL
       OR NOT (public.is_current_profile(v_author_id) OR public.is_current_staff()) THEN
        RAISE EXCEPTION '글 삭제 권한이 없습니다.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.community_channel_posts
    SET deleted_at = now()
    WHERE id = p_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_community_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_community_post(uuid) TO authenticated;
