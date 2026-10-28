BEGIN;
-- A revoked member can explicitly rejoin a standalone channel after an operator reopens it.
-- Reading one's own membership does not grant access to the channel or its posts.
CREATE POLICY community_members_own_read ON public.community_channel_members
FOR SELECT TO authenticated USING(public.is_current_profile(user_id));
NOTIFY pgrst,'reload schema';
COMMIT;
