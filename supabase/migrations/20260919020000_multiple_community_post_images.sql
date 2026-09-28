-- Add every selected image inside the same transaction as the challenge post.
-- A failed image or mission insert rolls the complete post back.
CREATE OR REPLACE FUNCTION public.create_online_challenge_post_with_media(
    p_payload jsonb, p_is_announcement boolean DEFAULT false
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_urls jsonb := COALESCE(p_payload->'image_urls', '[]'::jsonb);
    v_post_id uuid;
    v_index integer;
BEGIN
    IF jsonb_typeof(v_urls) <> 'array' OR jsonb_array_length(v_urls) > 10 THEN
        RAISE EXCEPTION '사진은 최대 10장까지 첨부할 수 있습니다.' USING ERRCODE = '23514';
    END IF;
    FOR v_index IN 0..jsonb_array_length(v_urls)-1 LOOP
        IF jsonb_typeof(v_urls->v_index) <> 'string'
           OR length(trim(v_urls->>v_index)) = 0 THEN
            RAISE EXCEPTION '사진 주소가 올바르지 않습니다.' USING ERRCODE = '23514';
        END IF;
    END LOOP;

    IF p_is_announcement THEN
        v_post_id := public.create_online_challenge_announcement(
            (p_payload - 'image_urls') || jsonb_build_object(
                'image_url', CASE WHEN jsonb_array_length(v_urls) > 0 THEN v_urls->>0 ELSE NULL END
            )
        );
    ELSE
        v_post_id := public.create_online_challenge_post(
            (p_payload - 'image_urls') || jsonb_build_object(
                'image_url', CASE WHEN jsonb_array_length(v_urls) > 0 THEN v_urls->>0 ELSE NULL END
            )
        );
    END IF;
    FOR v_index IN 1..jsonb_array_length(v_urls)-1 LOOP
        INSERT INTO public.community_post_media(post_id, media_url, sort_order)
        VALUES (v_post_id, v_urls->>v_index, v_index);
    END LOOP;
    RETURN v_post_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_online_challenge_post_with_media(jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_online_challenge_post_with_media(jsonb, boolean) TO authenticated;

-- Replace the ordered gallery only when the author still sees the exact
-- gallery they started editing. Existing storage objects are removed afterward.
CREATE OR REPLACE FUNCTION public.replace_community_post_media(
    p_post_id uuid, p_author_id uuid, p_expected_urls text[], p_next_urls text[]
)
RETURNS SETOF public.community_post_media
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_author_id uuid;
    v_current_urls text[];
    v_url text;
    v_index integer;
BEGIN
    SELECT author_id INTO v_author_id
    FROM public.community_channel_posts
    WHERE id = p_post_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND OR v_author_id <> p_author_id OR NOT public.is_current_profile(p_author_id) THEN
        RAISE EXCEPTION '본인 글의 사진만 수정할 수 있습니다.' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(array_length(p_next_urls, 1), 0) > 10 THEN
        RAISE EXCEPTION '사진은 최대 10장까지 첨부할 수 있습니다.' USING ERRCODE = '23514';
    END IF;
    SELECT COALESCE(array_agg(media_url ORDER BY sort_order), '{}'::text[])
    INTO v_current_urls FROM public.community_post_media WHERE post_id = p_post_id;
    IF v_current_urls <> COALESCE(p_expected_urls, '{}'::text[]) THEN
        RAISE EXCEPTION '사진이 다른 곳에서 변경되었습니다. 다시 불러와 주세요.' USING ERRCODE = '23514';
    END IF;
    FOREACH v_url IN ARRAY COALESCE(p_next_urls, '{}'::text[]) LOOP
        IF length(trim(COALESCE(v_url, ''))) = 0 THEN
            RAISE EXCEPTION '사진 주소가 올바르지 않습니다.' USING ERRCODE = '23514';
        END IF;
    END LOOP;

    DELETE FROM public.community_post_media WHERE post_id = p_post_id;
    FOR v_index IN 1..COALESCE(array_length(p_next_urls, 1), 0) LOOP
        INSERT INTO public.community_post_media(post_id, media_url, sort_order)
        VALUES (p_post_id, p_next_urls[v_index], v_index - 1);
    END LOOP;
    UPDATE public.community_channel_posts
    SET image_url = p_next_urls[1], updated_at = now()
    WHERE id = p_post_id;
    RETURN QUERY SELECT * FROM public.community_post_media
        WHERE post_id = p_post_id ORDER BY sort_order;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_community_post_media(uuid, uuid, text[], text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_community_post_media(uuid, uuid, text[], text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
