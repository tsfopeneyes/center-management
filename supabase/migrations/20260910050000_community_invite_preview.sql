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
SET search_path = public
AS $$
    SELECT
        c.id,
        c.name,
        c.description,
        (
            SELECT count(DISTINCT participant.user_id)
            FROM (
                SELECT m.user_id
                FROM public.community_channel_members m
                WHERE m.channel_id = c.id
                UNION
                SELECT nr.user_id
                FROM public.notice_responses nr
                WHERE nr.notice_id = c.source_notice_id
                  AND nr.status = 'JOIN'
            ) participant
        )::bigint,
        n.title
    FROM public.community_channels c
    LEFT JOIN public.notices n ON n.id = c.source_notice_id
    WHERE c.id = p_channel_id
      AND c.status = 'ACTIVE';
$$;

REVOKE ALL ON FUNCTION public.get_community_invite_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_community_invite_preview(uuid) TO anon, authenticated;
