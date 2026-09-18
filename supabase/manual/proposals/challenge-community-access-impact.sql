-- Read-only impact check before applying the access policy migration.
-- These direct members of linked channels will lose access unless they have
-- a JOIN response for the linked challenge. Staff access remains unchanged.
SELECT
    c.id AS channel_id,
    c.source_notice_id,
    count(*) AS direct_members_without_application
FROM public.community_channels c
JOIN public.community_channel_members m ON m.channel_id = c.id
WHERE c.source_notice_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.notice_responses nr
      WHERE nr.notice_id = c.source_notice_id
        AND nr.user_id = m.user_id
        AND nr.status = 'JOIN'
  )
GROUP BY c.id, c.source_notice_id
ORDER BY direct_members_without_application DESC, c.id;
