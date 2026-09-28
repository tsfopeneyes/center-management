import assert from 'node:assert/strict';
import { communityPushWindow, deliverCommunityPostPush } from '../supabase/functions/send-recruitment-alerts/community-post-worker.mjs';

assert.deepEqual(communityPushWindow(new Date('2026-09-18T14:59:59Z')),
    { allowed: true, nextSendAt: null }, '23:59:59 KST remains in the sending window');
assert.deepEqual(communityPushWindow(new Date('2026-09-18T15:00:00Z')),
    { allowed: false, nextSendAt: '2026-09-19T00:00:00.000Z' }, 'midnight KST waits until 09:00');
assert.deepEqual(communityPushWindow(new Date('2026-09-18T23:59:59Z')),
    { allowed: false, nextSendAt: '2026-09-19T00:00:00.000Z' }, '08:59:59 KST still waits');
assert.deepEqual(communityPushWindow(new Date('2026-09-19T00:00:00Z')),
    { allowed: true, nextSendAt: null }, '09:00 KST resumes delivery');

const postId = '00000000-0000-0000-0000-000000000101';
const userId = '00000000-0000-0000-0000-000000000002';
const authorId = '00000000-0000-0000-0000-000000000001';
const channelId = '00000000-0000-0000-0000-000000000011';
const recipient = { post_id: postId, user_id: userId, state: 'SENDING', attempts: 1,
    attempt_id: '00000000-0000-0000-0000-000000000999', next_attempt_at: new Date().toISOString() };
const post = { id: postId, author_id: authorId, deleted_at: null, is_hidden: false,
    channel_id: channelId, community_channels: { id: channelId, name: '챌린지', source_notice_id: 91, status: 'ACTIVE' } };
const updates = [];
let membershipActive = false;
const daytime = () => new Date('2026-09-19T03:00:00Z');
const db = {
    rpc: async name => ({ data: name === 'claim_community_post_push' ? [recipient] : [], error: null }),
    from(table) {
        const query = {
            patch: null,
            select() { return this; },
            update(patch) { this.patch = patch; return this; },
            eq() { return this; },
            lt() { return this; },
            async maybeSingle() {
                if (table === 'community_channel_posts') return { data: post, error: null };
                if (table === 'notice_responses') return { data: membershipActive ? { user_id: userId } : null, error: null };
                if (table === 'users') return { data: { id: userId, status: 'active', fcm_token: null }, error: null };
                throw new Error(`Unexpected table: ${table}`);
            },
            then(resolve) {
                if (table === 'community_post_push_recipients') updates.push(this.patch);
                else if (['community_post_push_digests', 'community_comment_push_recipients'].includes(table)) {}
                else if (table === 'push_devices' && !this.patch) {
                    return Promise.resolve({ data: [{ id: 'device-1', provider: 'FCM',
                        credential: { token: 'test-token' }, failure_count: 0, enabled: true }], error: null }).then(resolve);
                } else if (table !== 'push_devices') throw new Error(`Unexpected update: ${table}`);
                return Promise.resolve({ data: null, error: null }).then(resolve);
            },
        };
        return query;
    },
};
const quiet = await deliverCommunityPostPush({ db, origin: 'https://app.schoolchurchimpact.org',
    now: () => new Date('2026-09-18T15:00:00Z'), getFirebaseAccess: null, webpush: null });
assert.deepEqual(quiet, { claimed: 0, sent: 0, skipped: 0, failed: 0, deferred: true,
    nextSendAt: '2026-09-19T00:00:00.000Z' });

const result = await deliverCommunityPostPush({ db, origin: 'https://app.schoolchurchimpact.org', now: daytime,
    getFirebaseAccess: () => { throw new Error('A former member must never receive a push'); }, webpush: null });
assert.deepEqual(result, { claimed: 1, sent: 0, skipped: 1, failed: 0, deferred: 0 });
assert.equal(updates.at(-1).state, 'SKIPPED');
assert.equal(updates.at(-1).last_error_code, 'membership_ended');

membershipActive = true;
const originalFetch = globalThis.fetch;
let sentMessage;
globalThis.fetch = async (_url, options) => {
    sentMessage = JSON.parse(options.body).message;
    return { ok: true, status: 200 };
};
try {
    const delivered = await deliverCommunityPostPush({ db, origin: 'https://app.schoolchurchimpact.org', now: daytime,
        getFirebaseAccess: async () => ({ projectId: 'test', access: 'test' }), webpush: null });
    assert.deepEqual(delivered, { claimed: 1, sent: 1, skipped: 0, failed: 0, deferred: 0 });
    assert.equal(sentMessage.data.url, `https://app.schoolchurchimpact.org/community/${channelId}`);
    assert.equal(sentMessage.token, 'test-token');
} finally { globalThis.fetch = originalFetch; }
let ticks = 0;
const crossingMidnight = await deliverCommunityPostPush({ db, origin: 'https://app.schoolchurchimpact.org',
    now: () => new Date(ticks++ === 0 ? '2026-09-18T14:59:59Z' : '2026-09-18T15:00:00Z'),
    getFirebaseAccess: () => { throw new Error('No push may start after midnight'); }, webpush: null });
assert.deepEqual(crossingMidnight, { claimed: 1, sent: 0, skipped: 0, failed: 0, deferred: 1 });
assert.equal(updates.at(-1).state, 'PENDING');
assert.equal(updates.at(-1).attempts, 0);
assert.equal(updates.at(-1).next_attempt_at, '2026-09-19T00:00:00.000Z');
console.log('Community push worker verifies membership and sends the correct deep link.');
