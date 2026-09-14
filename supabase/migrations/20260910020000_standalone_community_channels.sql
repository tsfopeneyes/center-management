CREATE OR REPLACE FUNCTION public.is_joinable_standalone_channel(p_channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.community_channels c
        WHERE c.id = p_channel_id
          AND c.source_notice_id IS NULL
          AND c.channel_type = 'PRIVATE'
          AND c.status = 'ACTIVE'
    );
$$;

REVOKE ALL ON FUNCTION public.is_joinable_standalone_channel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_joinable_standalone_channel(uuid) TO authenticated;

DROP POLICY IF EXISTS community_channels_admin_insert ON public.community_channels;
CREATE POLICY community_channels_admin_insert ON public.community_channels
FOR INSERT WITH CHECK (public.is_community_admin());

DROP POLICY IF EXISTS community_members_self_join_standalone ON public.community_channel_members;
CREATE POLICY community_members_self_join_standalone ON public.community_channel_members
FOR INSERT WITH CHECK (
    public.is_current_profile(user_id)
    AND member_role = 'MEMBER'
    AND public.is_joinable_standalone_channel(channel_id)
);
