BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- The channel model is the only active community domain. Historical rows are
-- retained under explicit legacy names, removed from client access and realtime.
ALTER TABLE IF EXISTS public.community_comment_reactions RENAME TO legacy_community_feed_comment_reactions;
ALTER TABLE IF EXISTS public.community_likes RENAME TO legacy_community_feed_likes;
ALTER TABLE IF EXISTS public.community_comments RENAME TO legacy_community_feed_comments;
ALTER TABLE IF EXISTS public.community_posts RENAME TO legacy_community_feed_posts;

ALTER TABLE IF EXISTS public.guest_post_reactions RENAME TO legacy_azit_post_reactions;
ALTER TABLE IF EXISTS public.guest_comments RENAME TO legacy_azit_comments;
ALTER TABLE IF EXISTS public.guest_posts RENAME TO legacy_azit_posts;
ALTER TABLE IF EXISTS public.weekly_questions RENAME TO legacy_azit_weekly_questions;

REVOKE ALL ON TABLE
    public.legacy_community_feed_comment_reactions,
    public.legacy_community_feed_likes,
    public.legacy_community_feed_comments,
    public.legacy_community_feed_posts,
    public.legacy_azit_post_reactions,
    public.legacy_azit_comments,
    public.legacy_azit_posts,
    public.legacy_azit_weekly_questions
FROM anon, authenticated;

COMMENT ON TABLE public.legacy_community_feed_posts IS 'Retired pre-channel community feed. Historical data only; never use for active community features.';
COMMENT ON TABLE public.legacy_azit_posts IS 'Retired Azit/guestbook feed. Historical data only; never use for active community features.';
COMMENT ON TABLE public.community_channels IS 'Canonical active community root. All new community features must use community_channel_* tables.';

DO $$
DECLARE
    item text;
BEGIN
    FOREACH item IN ARRAY ARRAY[
        'legacy_community_feed_comment_reactions',
        'legacy_community_feed_likes',
        'legacy_community_feed_comments',
        'legacy_community_feed_posts',
        'legacy_azit_post_reactions',
        'legacy_azit_comments',
        'legacy_azit_posts'
    ] LOOP
        IF EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = item
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', item);
        END IF;
    END LOOP;
END $$;

DO $$
DECLARE
    proc regprocedure;
BEGIN
    FOR proc IN
        SELECT p.oid::regprocedure
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('increment_post_likes','decrement_post_likes','increment_post_comments','decrement_post_comments')
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', proc);
    END LOOP;
END $$;

-- Remove retired navigation ids from the persisted student tab layout.
UPDATE public.notices
SET content = COALESCE((
    SELECT jsonb_agg(item ORDER BY ordinality)
    FROM jsonb_array_elements(content::jsonb) WITH ORDINALITY AS entries(item, ordinality)
    WHERE item->>'id' NOT IN ('azit', 'community', 'guestbook')
), '[]'::jsonb)::text
WHERE category = 'SYSTEM'
  AND title = 'STUDENT_TAB_CONFIG'
  AND jsonb_typeof(content::jsonb) = 'array';

-- Account merges must preserve both canonical community activity and archived history.
GRANT SELECT, UPDATE, DELETE ON
    public.community_channel_members,
    public.community_channel_posts,
    public.community_channel_comments,
    public.community_channel_reactions,
    public.community_channel_comment_reactions
TO account_merge_worker;

DO $$
DECLARE
    item text;
BEGIN
    FOREACH item IN ARRAY ARRAY[
        'community_channel_members',
        'community_channel_posts',
        'community_channel_comments',
        'community_channel_reactions',
        'community_channel_comment_reactions'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS account_merge_worker_access ON public.%I', item);
        EXECUTE format(
            'CREATE POLICY account_merge_worker_access ON public.%I TO account_merge_worker USING (true) WITH CHECK (true)',
            item
        );
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
