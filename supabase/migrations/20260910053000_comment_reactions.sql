CREATE TABLE IF NOT EXISTS public.notice_comment_reactions (
    comment_id bigint NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    emoji text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 32),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (comment_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.community_comment_reactions (
    comment_id uuid NOT NULL REFERENCES public.community_comments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    emoji text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 32),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (comment_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.community_channel_comment_reactions (
    comment_id uuid NOT NULL REFERENCES public.community_channel_comments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    emoji text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 32),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (comment_id, user_id, emoji)
);

ALTER TABLE public.notice_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_channel_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY notice_comment_reactions_read ON public.notice_comment_reactions FOR SELECT USING (true);
CREATE POLICY notice_comment_reactions_insert ON public.notice_comment_reactions FOR INSERT WITH CHECK (public.is_current_profile(user_id));
CREATE POLICY notice_comment_reactions_delete ON public.notice_comment_reactions FOR DELETE USING (public.is_current_profile(user_id) OR public.is_community_admin());

CREATE POLICY community_comment_reactions_read ON public.community_comment_reactions FOR SELECT USING (true);
CREATE POLICY community_comment_reactions_insert ON public.community_comment_reactions FOR INSERT WITH CHECK (public.is_current_profile(user_id));
CREATE POLICY community_comment_reactions_delete ON public.community_comment_reactions FOR DELETE USING (public.is_current_profile(user_id) OR public.is_community_admin());

CREATE POLICY channel_comment_reactions_read ON public.community_channel_comment_reactions
FOR SELECT USING (
    public.can_access_community_channel((
        SELECT post.channel_id
        FROM public.community_channel_comments AS comment
        JOIN public.community_channel_posts AS post ON post.id = comment.post_id
        WHERE comment.id = comment_id
    ))
    OR public.is_community_admin()
);
CREATE POLICY channel_comment_reactions_insert ON public.community_channel_comment_reactions
FOR INSERT WITH CHECK (
    public.is_current_profile(user_id)
    AND public.can_access_community_channel((
        SELECT post.channel_id
        FROM public.community_channel_comments AS comment
        JOIN public.community_channel_posts AS post ON post.id = comment.post_id
        WHERE comment.id = comment_id
    ), user_id)
);
CREATE POLICY channel_comment_reactions_delete ON public.community_channel_comment_reactions
FOR DELETE USING (public.is_current_profile(user_id) OR public.is_community_admin());

GRANT SELECT ON public.notice_comment_reactions, public.community_comment_reactions TO anon;
GRANT SELECT, INSERT, DELETE ON public.notice_comment_reactions, public.community_comment_reactions, public.community_channel_comment_reactions TO authenticated;
