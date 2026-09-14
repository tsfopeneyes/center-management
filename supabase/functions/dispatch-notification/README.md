# Central notification server rollout

All visit, program-application, coffee-chat and rental notifications use the
`notify-event` action. Callers send source row IDs; this function reloads the
source data, resolves the center and selects LINE/Slack destinations.

Center routing rules:

- Program application: `notices.target_regions`
- Check-in/out: `logs.location_id` -> `locations` -> `location_groups`
- Rental: `rental_bookings` -> `rentals` -> `schools.region`
- Coffee chat: staff assignment in `STAFF_PRESENCE_CONFIG`
- Unknown or conflicting center: fail closed without external delivery

## Safe rollout order

1. Deploy `dispatch-notification` to the existing Supabase project.
2. In Supabase Edge Function secrets, add the existing integration values:
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_HAIFN_GROUP_ID`
   - `LINE_ENOUGH_GROUP_ID`
   - Optional separate-bot tokens: `LINE_HAIFN_CHANNEL_ACCESS_TOKEN`, `LINE_ENOUGH_CHANNEL_ACCESS_TOKEN`
   - Temporary legacy fallbacks: `LINE_HAIFN_PROXY_URL`, `LINE_ENOUGH_PROXY_URL`
   - `SLACK_BOT_TOKEN`
   - `SLACK_HAIFN_CHANNEL_ID` (falls back to the legacy `SLACK_ALERT_CHANNEL_ID`)
   - `SLACK_ENOUGH_CHANNEL_ID` (optional until Enough Place Slack is enabled)
   - `GOOGLE_SHEETS_WEBHOOK_URL` and `DISCORD_WEBHOOK_URL` for legacy non-event actions
3. Review and apply `20260909010000_notification_delivery_log.sql`. Until it is
   applied, delivery still works but durable duplicate prevention/auditing is unavailable.
4. Save the per-center matrix in the admin integration screen. It is stored as
   the non-secret `notification_routing_config` global setting.
5. Test these isolated routes before enabling real traffic:
   - Haifn check-in/out -> Haifn LINE/Slack only
   - Enough Place check-in/out -> Enough Place LINE and configured Slack only
   - Gangdong-only program -> Haifn routes only
   - Gangseo-only program -> Enough Place routes only
   - Gangdong+Gangseo program -> both centers exactly once
6. Deploy the web app only after the Edge Function, secrets and migration are ready.

Provider tokens, LINE room IDs and Slack channel IDs must not be copied into
browser storage or `global_settings`.
