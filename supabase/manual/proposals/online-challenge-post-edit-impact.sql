-- Read-only impact check before applying the post-category edit migration.
-- The migration changes no existing rows. These counts show the records that
-- could later be edited and the reward-protected records.
SELECT
    count(*) FILTER (WHERE s.id IS NULL) AS free_posts,
    count(*) FILTER (WHERE s.is_valid) AS mission_posts,
    count(*) FILTER (WHERE s.id IS NOT NULL AND NOT s.is_valid) AS previously_invalidated_posts,
    count(*) FILTER (WHERE s.is_valid AND r.participant_id IS NOT NULL) AS reward_protected_posts
FROM public.community_channel_posts p
JOIN public.community_channels c ON c.id = p.channel_id
JOIN public.notices n ON n.id = c.source_notice_id
LEFT JOIN public.online_challenge_submissions s ON s.post_id = p.id
LEFT JOIN public.challenge_completion_rewards r
    ON r.challenge_id = n.id AND r.participant_id = p.author_id
WHERE p.deleted_at IS NULL
  AND n.is_challenge AND n.challenge_format = 'ONLINE' AND n.community_enabled;
