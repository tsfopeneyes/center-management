-- Linked challenge channels use the program application as their membership.
-- Direct channel members remain valid only for standalone private channels.
CREATE OR REPLACE FUNCTION public.can_access_community_channel(
    p_channel_id uuid,
    p_profile_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT public.is_current_staff()
    OR EXISTS (
        SELECT 1
        FROM public.community_channels c
        JOIN public.notices n ON n.id = c.source_notice_id
        JOIN public.notice_responses nr
          ON nr.notice_id = c.source_notice_id
         AND nr.status = 'JOIN'
        WHERE c.id = p_channel_id
          AND c.status = 'ACTIVE'
          AND n.is_challenge
          AND n.challenge_format = 'ONLINE'
          AND n.community_enabled
          AND nr.user_id = account_security.current_profile_id()
    )
    OR EXISTS (
        SELECT 1
        FROM public.community_channels c
        JOIN public.community_channel_members m ON m.channel_id = c.id
        WHERE c.id = p_channel_id
          AND c.source_notice_id IS NULL
          AND c.channel_type = 'PRIVATE'
          AND c.status = 'ACTIVE'
          AND m.user_id = account_security.current_profile_id()
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_community_channel(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_community_channel(uuid, uuid) TO anon, authenticated, service_role;

-- Count approved applicants for linked challenges; direct members (including
-- hosts) are counted only for standalone channels.
CREATE OR REPLACE FUNCTION public.get_community_invite_preview(p_channel_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    participant_count bigint,
    source_title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT
        c.id,
        c.name,
        c.description,
        CASE WHEN c.source_notice_id IS NOT NULL THEN (
            SELECT count(DISTINCT nr.user_id)
            FROM public.notice_responses nr
            WHERE nr.notice_id = c.source_notice_id AND nr.status = 'JOIN'
        ) ELSE (
            SELECT count(DISTINCT m.user_id)
            FROM public.community_channel_members m
            WHERE m.channel_id = c.id
        ) END::bigint,
        n.title
    FROM public.community_channels c
    LEFT JOIN public.notices n ON n.id = c.source_notice_id
    WHERE c.id = p_channel_id AND c.status = 'ACTIVE';
$$;

REVOKE ALL ON FUNCTION public.get_community_invite_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_community_invite_preview(uuid) TO anon, authenticated;
