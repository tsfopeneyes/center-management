-- The merge worker must inspect every user FK before deleting a guest profile.
-- This grants read access only; unreviewed activity still blocks the merge.
DO $grant_merge_audit$
DECLARE relation_name text; policy_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'challenge_completion_rewards','community_channel_read_cursors',
    'community_comment_push_recipients','community_post_push_digests',
    'community_post_push_recipients','daily_program_session_responses',
    'legacy_community_feed_comment_reactions','notice_comment_reactions',
    'offline_challenge_submissions','online_challenge_submissions',
    'open_program_attendance','program_close_reward_grants',
    'program_push_recipients','push_devices','push_dispatch_recipients','push_dispatches'
  ] LOOP
    IF to_regclass('public.' || relation_name) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON public.%I TO account_merge_worker',relation_name);
      policy_name='account_merge_audit_' || substr(md5(relation_name),1,16);
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
        AND tablename=relation_name AND policyname=policy_name) THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO account_merge_worker USING(true)',
          policy_name,relation_name);
      END IF;
    END IF;
  END LOOP;
END
$grant_merge_audit$;
