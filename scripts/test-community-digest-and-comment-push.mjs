import assert from 'node:assert/strict';
import { deliverCommunityPostPush } from '../supabase/functions/send-recruitment-alerts/community-post-worker.mjs';

const channelId = '00000000-0000-0000-0000-000000000011';
const userId = '00000000-0000-0000-0000-000000000002';
const authorId = '00000000-0000-0000-0000-000000000001';
const id = number => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const claim = (kind, data) => ({ ...data, kind, state: 'SENDING', attempts: 1,
    attempt_id: id(999), next_attempt_at: '2026-09-19T00:00:00Z' });
const digest = claim('digest', { id: id(50), channel_id: channelId, user_id: userId,
    post_ids: [id(101), id(102), id(103)], comment_ids: [] });
const comment = claim('comment', { comment_id: id(201), post_id: id(101), user_id: userId });
const commentDigest = claim('digest', { id: id(51), channel_id: channelId, user_id: userId,
    post_ids: [], comment_ids: [id(201)] });
const channel = { id: channelId, name: '챌린지', source_notice_id: 91, status: 'ACTIVE' };
let target = digest;
let mentioning = false;
let membershipActive = true;
let mentionedIds = [userId];
let announcementFlags = [false, false, false];
const updates = [];
const db = {
    rpc: async name => ({ data: name === 'claim_community_post_push_digests' && target.kind === 'digest'
        || name === 'claim_community_comment_push' && target.kind === 'comment' ? [target] : [], error: null }),
    from(table) {
        return {
            patch: null,
            select() { return this; }, update(patch) { this.patch = patch; return this; },
            eq() { return this; }, lt() { return this; }, in() { return this; },
            async maybeSingle() {
                if (['community_channels', 'community_channel_directory'].includes(table)) return { data: channel, error: null };
                if (table === 'community_channel_comments') return { data: {
                    id: comment.comment_id, user_id: authorId, is_hidden: false, mentioned_user_ids: mentioning ? mentionedIds : [],
                    community_channel_posts: { id: id(101), author_id: mentioning ? authorId : userId, deleted_at: null,
                        is_hidden: false, channel_id: channelId, community_channels: channel },
                }, error: null };
                if (table === 'community_channel_participants') return { data: membershipActive ? { user_id: userId } : null, error: null };
                if (table === 'notices') return { data: null, error: null };
                if (table === 'users') return { data: { id: userId, status: 'active',
                    fcm_token: null, account_role: 'member' }, error: null };
                throw new Error(`Unexpected single table ${table}`);
            },
            then(resolve) {
                if (this.patch) {
                    if (['community_post_push_digests', 'community_comment_push_recipients'].includes(table))
                        updates.push({ table, ...this.patch });
                    return Promise.resolve({ data: null, error: null }).then(resolve);
                }
                if (table === 'community_channel_posts') return Promise.resolve({ data: [
                    { id: id(101), author_id: authorId, deleted_at: null, is_hidden: false },
                    { id: id(102), author_id: authorId, deleted_at: null, is_hidden: false },
                    { id: id(103), author_id: authorId, deleted_at: null, is_hidden: false },
                ].map((post, index) => ({ ...post, is_announcement: announcementFlags[index] })), error: null }).then(resolve);
                if (table === 'community_channel_comments') return Promise.resolve({ data: [{
                    id: id(201), user_id: authorId, is_hidden: false, mentioned_user_ids: mentioning ? mentionedIds : [],
                    community_channel_posts: { id: id(101), author_id: mentioning ? authorId : userId,
                        deleted_at: null, is_hidden: false },
                }], error: null }).then(resolve);
                if (table === 'push_devices') return Promise.resolve({ data: [{ id: id(301),
                    provider: 'FCM', credential: { token: 'test-token' }, enabled: true,
                    failure_count: 0 }], error: null }).then(resolve);
                throw new Error(`Unexpected list table ${table}`);
            },
        };
    },
};
let messages = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
    messages.push(JSON.parse(options.body).message);
    return { ok: true, status: 200 };
};
try {
    const args = { db, origin: 'https://app.schoolchurchimpact.org',
        now: () => new Date('2026-09-19T00:00:00Z'),
        getFirebaseAccess: async () => ({ projectId: 'test', access: 'test' }), webpush: null };
    let result = await deliverCommunityPostPush(args);
    assert.equal(result.sent, 1);
    assert.equal(messages.length, 1, 'three overnight posts produce exactly one push');
    assert.match(messages[0].notification.title, /밤사이/);
    assert.equal(updates.at(-1).state, 'SENT');
    announcementFlags = [true, true, true];
    messages = [];
    result = await deliverCommunityPostPush(args);
    assert.equal(result.sent, 1);
    assert.equal(messages[0].notification.title, '챌린지에 밤사이 공지가 등록됐어요');
    assert.equal(messages[0].notification.body, '밤사이 올라온 공지를 확인해 보세요.');
    announcementFlags = [false, true, false];
    messages = [];
    result = await deliverCommunityPostPush(args);
    assert.equal(result.sent, 1);
    assert.equal(messages[0].notification.title, '챌린지에 밤사이 공지와 새 글이 올라왔어요');
    announcementFlags = [false, false, false];
    messages = [];
    target = comment;
    result = await deliverCommunityPostPush(args);
    assert.equal(result.sent, 1);
    assert.equal(messages.length, 1);
    assert.match(messages[0].notification.title, /댓글/);
    assert.equal(messages[0].data.url, `https://app.schoolchurchimpact.org/community/${channelId}?from=push&post=${id(101)}`);
    messages = [];
    target = commentDigest;
    result = await deliverCommunityPostPush(args);
    assert.equal(result.sent, 1);
    assert.equal(messages.length, 1);
    assert.match(messages[0].notification.title, /댓글/);
    assert.doesNotMatch(messages[0].notification.title, /새 글/);
    mentioning = true;
    target = comment;
    messages = [];
    result = await deliverCommunityPostPush(args);
    assert.equal(result.sent, 1, 'Mentioned participant who did not author the post receives a push');
    assert.match(messages[0].notification.title, /태그/);
    assert.equal(messages[0].data.url, `https://app.schoolchurchimpact.org/community/${channelId}?from=push&post=${id(101)}`);
    target = commentDigest;
    messages = [];
    result = await deliverCommunityPostPush(args);
    assert.equal(result.sent, 1, 'Nightly mention-only digest is delivered');
    assert.match(messages[0].notification.title, /태그/);
    assert.equal(messages[0].data.url, `https://app.schoolchurchimpact.org/community/${channelId}?from=push`);
    target = comment;
    membershipActive = false;
    messages = [];
    result = await deliverCommunityPostPush(args);
    assert.equal(result.skipped, 1, 'Former participant cannot receive a mention push');
    assert.equal(messages.length, 0);
    membershipActive = true;
    mentionedIds = [];
    result = await deliverCommunityPostPush(args);
    assert.equal(result.skipped, 1, 'Removed mention is rechecked before sending');
} finally { globalThis.fetch = originalFetch; }
console.log('Morning digest sends once per recipient and comment alert reaches the post author.');
