import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const dashboard = read('../src/pages/StudentDashboard.jsx');
const hook = read('../src/hooks/useStudentDashboard.jsx');
const constants = read('../src/constants/appConstants.js');
const settings = read('../src/components/admin/settings/hooks/useAdminSettings.jsx');
const merge = read('../supabase/functions/_shared/accountMergeService.mjs');
const migration = read('../supabase/migrations/20260911060000_retire_legacy_community_and_guestbook.sql');

for (const retired of [
    'src/api/communityApi.js', 'src/api/guestbookApi.js', 'src/hooks/useGuestbook.js',
    'src/components/community/CommunityTab.jsx', 'src/components/student/StudentAzitTab.jsx',
    'src/components/student/StudentGuestbookTab.jsx', 'src/components/admin/board/AdminGuestbook.jsx'
]) assert.equal(existsSync(`${root}${retired}`), false, `${retired} must remain retired`);

for (const source of [dashboard, hook, constants, settings]) {
    assert.doesNotMatch(source, /TAB_NAMES\.(AZIT|COMMUNITY|GUESTBOOK)|id:\s*'azit'/);
}
assert.match(migration, /legacy_azit_posts/);
assert.match(migration, /legacy_community_feed_posts/);
assert.match(migration, /REVOKE ALL ON TABLE/);
assert.match(migration, /community_channel_posts/);
assert.match(merge, /\['community_channel_posts','author_id'\]/);
assert.match(merge, /\['legacy_community_feed_posts','author_id'\]/);
assert.doesNotMatch(merge, /\['community_posts','user_id'\]/);

console.log('PASS community domains: channel community is canonical and retired feeds are isolated');
