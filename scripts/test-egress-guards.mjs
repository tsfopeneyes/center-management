import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [presence, admin, tv, screen, noticeModal, pushAdmin] = await Promise.all([
    read('src/hooks/dashboard/useRealtimePresence.js'),
    read('src/pages/AdminDashboard.jsx'),
    read('src/pages/TvSignageViewer.jsx'),
    read('src/pages/ScreenViewer.jsx'),
    read('src/components/student/NoticeModal.jsx'),
    read('src/components/admin/notifications/AdminPushNotifications.jsx'),
]);

assert.match(presence, /mergeRealtimeVisitLog\(logsRef\.current, payload\)/, 'Student presence must apply realtime log rows locally.');
assert.doesNotMatch(presence, /debouncedFetchStatus/, 'A normal log event must not use the former full-snapshot debounce path.');

assert.match(admin, /select\('id,user_id,location_id,type,created_at,metadata,duration'\)/, 'Admin live refresh must retain every field used by the automatic sheet sync.');
assert.match(admin, /completeLiveLogs = liveLogs\.map\(log => \(\{ \.\.\.previousById\.get\(log\.id\), \.\.\.log \}\)\)/, 'Compact live rows must preserve already-loaded log fields.');
assert.match(admin, /setInterval\(refreshOccupancy, 60000\)/, 'Admin fallback refresh must remain low frequency.');

assert.doesNotMatch(tv, /from\('logs'\)[\s\S]{0,100}select\('\*[^']*'/, 'TV must not download every log column.');
assert.match(tv, /tv-signage-logs-/, 'TV must retain immediate realtime updates.');

assert.match(screen, /status !== 'SUBSCRIBED'[\s\S]{0,100}hasSubscribed\) refresh\(\)/, 'Screen config must refresh whenever realtime reconnects.');
assert.match(screen, /60000/, 'Screen config must keep a bounded recovery poll.');
assert.match(noticeModal, /notice-teams-/, 'Team assignment must retain realtime updates.');
assert.doesNotMatch(noticeModal, /setInterval\(fetchParticipantsAndSeed, 2500\)/, 'Team assignment must not poll every 2.5 seconds.');

assert.match(pushAdmin, /document\.visibilityState === "visible"\) refreshHistory\(\)/, 'Push receipt polling must refresh history only.');
assert.match(pushAdmin, /channel\("admin-push-targets"\)/, 'Push targets must refresh immediately when source tables change.');
assert.match(pushAdmin, /setInterval\(refreshEverything, 300000\)/, 'Push targets must recover even if a realtime event is missed.');

console.log('Egress guard checks passed.');
