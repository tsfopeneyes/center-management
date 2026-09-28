import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const worker = read('supabase/functions/send-recruitment-alerts/dm-push-worker.mjs');
const endpoint = read('supabase/functions/send-dm-push/index.ts');
const config = read('supabase/config.toml');
const queue = read('supabase/migrations/20260922044000_direct_message_push.sql');
const schedule = read('supabase/migrations/20260922045000_schedule_notification_delivery.sql');
const foreground = read('src/hooks/useFCM.js');

assert.match(config, /\[functions\.send-dm-push\][\s\S]*verify_jwt\s*=\s*false/);
assert.match(endpoint, /RECRUITMENT_ALERTS_CRON_SECRET/);
assert.match(endpoint, /equal\(request\.headers\.get\('Authorization'\)/);
assert.match(worker, /eq\('state', 'SENDING'\)\.lt\('updated_at', staleBefore\)/);
assert.match(worker, /state: 'FAILED'.*attempt_id: null/s);
assert.match(worker, /\.eq\('state', row\.state\)\.eq\('attempts', row\.attempts\)/);
assert.match(worker, /membership_ended/);
assert.match(worker, /staff_access_changed/);
assert.match(worker, /preference_disabled/);
assert.match(queue, /UNIQUE\(message_id, recipient_id\)/);
assert.match(queue, /state IN \('PENDING', 'FAILED'\)/);
assert.match(queue, /message_revoked/);
assert.match(schedule, /REFERENCING NEW TABLE AS queued_dm_push_rows/);
assert.match(schedule, /'\*\/5 \* \* \* \*'/);
assert.match(schedule, /dm_purge_expired_push_deliveries/);
assert.match(schedule, /interval '7 days'/);
assert.match(schedule, /interval '30 days'/);
assert.match(worker, /'DEAD'/);
assert.match(worker, /\? `\$\{String\(message\.conversation\.title \|\| '그룹 대화'\).*\}: \$\{senderName\}`/);
assert.match(worker, /: senderName;/);
assert.match(foreground, /sci_active_dm_conversation/);

console.log('DM push safety checks passed');
