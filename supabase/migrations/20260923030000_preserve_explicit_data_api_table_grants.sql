-- Preserve the Data API access that these existing public tables currently have.
--
-- Supabase is ending automatic Data API grants for newly-created public tables.
-- Keeping these grants explicit makes migration replays and new environments match
-- the linked production project without changing its current access model. RLS
-- policies remain the authorization boundary for rows.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.contents,
  public.rentals,
  public.rental_bookings,
  public.tsf_notion_index,
  public.tsf_pending_actions,
  public.kiosk_devices,
  public.kiosk_activation_attempts,
  public.surveys,
  public.survey_assignments,
  public.community_channels,
  public.community_channel_members,
  public.community_channel_posts,
  public.community_channel_comments,
  public.community_channel_reactions,
  public.calling_forest_progress
TO anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.contents,
  public.rentals,
  public.rental_bookings,
  public.tsf_notion_index,
  public.tsf_pending_actions,
  public.kiosk_devices,
  public.kiosk_activation_attempts,
  public.surveys,
  public.survey_assignments,
  public.community_channels,
  public.community_channel_members,
  public.community_channel_posts,
  public.community_channel_comments,
  public.community_channel_reactions,
  public.calling_forest_progress
TO service_role;
