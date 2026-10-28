import { isRegisteredChallengeHost } from './community-host-recipients.mjs';

const checked = ({ data, error }) => {
    if (error) throw error;
    return data;
};

const parseTokens = value => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(String(value));
        if (Array.isArray(parsed)) return parsed.filter(token => typeof token === 'string' && token);
    } catch { /* Legacy single token. */ }
    return [String(value)];
};

// Korea has no daylight-saving time. 09:00 KST is 00:00 UTC on the same
// Korean calendar date. Posts written from midnight through 08:59 wait there.
export const communityPushWindow = (instant = new Date()) => {
    const korea = new Date(instant.getTime() + 9 * 60 * 60 * 1000);
    if (korea.getUTCHours() >= 9) return { allowed: true, nextSendAt: null };
    return { allowed: false, nextSendAt: new Date(Date.UTC(
        korea.getUTCFullYear(), korea.getUTCMonth(), korea.getUTCDate(), 0, 0, 0,
    )).toISOString() };
};

export const claimCommunityPush = async db => {
    const { data, error } = await db.rpc('claim_community_post_push', { p_limit: 40 });
    if (!error) return data || [];
    if (!['PGRST202', '42883'].includes(error.code)) throw error;

    // Direct-table fallback while PostgREST refreshes the function cache.
    const now = new Date().toISOString();
    const due = checked(await db.from('community_post_push_recipients').select('*')
        .in('state', ['PENDING', 'FAILED']).lt('attempts', 3)
        .lte('next_attempt_at', now).order('next_attempt_at').limit(40));
    const claimed = [];
    for (const row of due || []) {
        const attemptId = crypto.randomUUID();
        const updated = checked(await db.from('community_post_push_recipients')
            .update({ state: 'SENDING', attempts: row.attempts + 1, attempt_id: attemptId, updated_at: now })
            .eq('post_id', row.post_id).eq('user_id', row.user_id).eq('state', row.state)
            .eq('attempts', row.attempts).select('*').maybeSingle());
        if (updated) claimed.push(updated);
    }
    return claimed;
};

export const claimCommunityDigests = async db => {
    const { data, error } = await db.rpc('claim_community_post_push_digests', { p_limit: 40 });
    if (!error) return data || [];
    if (!['PGRST202', '42883'].includes(error.code)) throw error;

    // Direct-table fallback while the new function is refreshing.
    const timestamp = new Date().toISOString();
    const due = checked(await db.from('community_post_push_digests').select('*')
        .in('state', ['PENDING', 'FAILED']).lt('attempts', 3)
        .lte('next_attempt_at', timestamp).order('next_attempt_at').limit(40));
    const claimed = [];
    for (const row of due || []) {
        const updated = checked(await db.from('community_post_push_digests')
            .update({ state: 'SENDING', attempts: row.attempts + 1,
                attempt_id: crypto.randomUUID(), updated_at: timestamp })
            .eq('id', row.id).eq('state', row.state).eq('attempts', row.attempts)
            .select('*').maybeSingle());
        if (updated) claimed.push(updated);
    }
    return claimed;
};

export const claimCommunityComments = async db => {
    const { data, error } = await db.rpc('claim_community_comment_push', { p_limit: 40 });
    if (!error) return data || [];
    if (!['PGRST202', '42883'].includes(error.code)) throw error;
    const timestamp = new Date().toISOString();
    const due = checked(await db.from('community_comment_push_recipients').select('*')
        .in('state', ['PENDING', 'FAILED']).lt('attempts', 3)
        .lte('next_attempt_at', timestamp).order('next_attempt_at').limit(40));
    const claimed = [];
    for (const row of due || []) {
        const updated = checked(await db.from('community_comment_push_recipients')
            .update({ state: 'SENDING', attempts: row.attempts + 1,
                attempt_id: crypto.randomUUID(), updated_at: timestamp })
            .eq('comment_id', row.comment_id).eq('state', row.state).eq('attempts', row.attempts)
            .select('*').maybeSingle());
        if (updated) claimed.push(updated);
    }
    return claimed;
};

export const deliverCommunityPostPush = async ({ db, getFirebaseAccess, webpush, origin, now = () => new Date() }) => {
    const entryWindow = communityPushWindow(now());
    if (!entryWindow.allowed) return { claimed: 0, sent: 0, skipped: 0, failed: 0, deferred: true,
        nextSendAt: entryWindow.nextSendAt };
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    checked(await db.from('community_post_push_recipients')
        .update({ state: 'UNCERTAIN', attempt_id: null, last_error_code: 'stale_claim',
            updated_at: new Date().toISOString() })
        .eq('state', 'SENDING').lt('updated_at', stale));
    checked(await db.from('community_post_push_digests')
        .update({ state: 'UNCERTAIN', attempt_id: null, last_error_code: 'stale_claim',
            updated_at: new Date().toISOString() })
        .eq('state', 'SENDING').lt('updated_at', stale));
    checked(await db.from('community_comment_push_recipients')
        .update({ state: 'UNCERTAIN', attempt_id: null, last_error_code: 'stale_claim',
            updated_at: new Date().toISOString() })
        .eq('state', 'SENDING').lt('updated_at', stale));
    const [posts, digests, comments] = await Promise.all([
        claimCommunityPush(db), claimCommunityDigests(db), claimCommunityComments(db)]);
    const claimed = [...posts.map(row => ({ ...row, kind: 'post' })),
        ...digests.map(row => ({ ...row, kind: 'digest' })),
        ...comments.map(row => ({ ...row, kind: 'comment' }))];
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let deferred = 0;
    const finish = async (row, state, code = null) => {
        const retry = state === 'FAILED' && row.attempts < 3;
        const table = row.kind === 'digest' ? 'community_post_push_digests'
            : row.kind === 'comment' ? 'community_comment_push_recipients' : 'community_post_push_recipients';
        let query = db.from(table).update({
            state, last_error_code: code, attempt_id: null, updated_at: new Date().toISOString(),
            next_attempt_at: retry ? new Date(Date.now() + 120000).toISOString() : row.next_attempt_at,
        });
        query = row.kind === 'digest' ? query.eq('id', row.id)
            : row.kind === 'comment' ? query.eq('comment_id', row.comment_id)
                : query.eq('post_id', row.post_id).eq('user_id', row.user_id);
        checked(await query.eq('attempt_id', row.attempt_id));
        if (state === 'SENT') sent++;
        else if (state === 'SKIPPED') skipped++;
        else failed++;
    };
    const defer = async (row, nextSendAt) => {
        const table = row.kind === 'digest' ? 'community_post_push_digests'
            : row.kind === 'comment' ? 'community_comment_push_recipients' : 'community_post_push_recipients';
        let query = db.from(table).update({
            state: 'PENDING', attempts: Math.max(0, row.attempts - 1), attempt_id: null,
            next_attempt_at: nextSendAt, last_error_code: null, updated_at: new Date().toISOString(),
        });
        query = row.kind === 'digest' ? query.eq('id', row.id)
            : row.kind === 'comment' ? query.eq('comment_id', row.comment_id)
                : query.eq('post_id', row.post_id).eq('user_id', row.user_id);
        checked(await query.eq('attempt_id', row.attempt_id));
        deferred++;
    };
    const deliver = async row => {
        try {
            const currentWindow = communityPushWindow(now());
            if (!currentWindow.allowed) return defer(row, currentWindow.nextSendAt);
            let post = null;
            let channel = null;
            let commentAvailable = false;
            let authorCommentAvailable = false;
            let mentionAvailable = false;
            let postLabel = '새 글';
            if (row.kind === 'digest') {
                channel = checked(await db.from('community_channels')
                    .select('id,name,source_notice_id,status').eq('id', row.channel_id).maybeSingle());
                if (row.post_ids?.length) {
                    const digestPosts = checked(await db.from('community_channel_posts')
                        .select('id,author_id,deleted_at,is_hidden,is_announcement').in('id', row.post_ids));
                    const availablePosts = digestPosts?.filter(item => !item.deleted_at && !item.is_hidden
                        && item.author_id !== row.user_id) || [];
                    post = availablePosts[0];
                    if (availablePosts.some(item => item.is_announcement)) {
                        postLabel = availablePosts.some(item => !item.is_announcement) ? '공지와 새 글' : '공지';
                    }
                }
                if (row.comment_ids?.length) {
                    const digestComments = checked(await db.from('community_channel_comments')
                        .select('id,user_id,is_hidden,mentioned_user_ids,community_channel_posts(id,author_id,deleted_at,is_hidden)')
                        .in('id', row.comment_ids));
                    const validComments = digestComments?.filter(item => !item.is_hidden
                        && item.user_id !== row.user_id
                        && !item.community_channel_posts?.deleted_at
                        && item.community_channel_posts && !item.community_channel_posts.is_hidden) || [];
                    authorCommentAvailable = validComments.some(item => item.community_channel_posts.author_id === row.user_id);
                    mentionAvailable = validComments.some(item => item.mentioned_user_ids?.includes(row.user_id));
                    commentAvailable = authorCommentAvailable || mentionAvailable;
                }
            } else if (row.kind === 'comment') {
                const comment = checked(await db.from('community_channel_comments')
                    .select('id,user_id,is_hidden,mentioned_user_ids,community_channel_posts(id,author_id,deleted_at,is_hidden,channel_id,community_channels(id,name,source_notice_id,status))')
                    .eq('id', row.comment_id).maybeSingle());
                post = comment?.community_channel_posts;
                channel = post?.community_channels;
                const validComment = Boolean(comment && !comment.is_hidden && comment.user_id !== row.user_id && post);
                authorCommentAvailable = validComment && post.author_id === row.user_id;
                mentionAvailable = validComment && Boolean(comment.mentioned_user_ids?.includes(row.user_id));
                commentAvailable = authorCommentAvailable || mentionAvailable;
            } else {
                post = checked(await db.from('community_channel_posts')
                    .select('id,author_id,deleted_at,is_hidden,is_announcement,channel_id,community_channels(id,name,source_notice_id,status)')
                    .eq('id', row.post_id).maybeSingle());
                channel = post?.community_channels;
                if (post?.is_announcement) postLabel = '공지';
            }
            if (channel) channel = checked(await db.from('community_channel_directory').select('id,name,source_notice_id,status,is_open_program').eq('id', channel.id).maybeSingle());
            if (!channel || channel.status !== 'ACTIVE'
                || (!post && !commentAvailable)
                || (post && (post.deleted_at || post.is_hidden))
                || (row.kind === 'post' && post.author_id === row.user_id)
                || (row.kind === 'comment' && !commentAvailable))
                return finish(row, 'SKIPPED', 'post_unavailable');
            const membership = checked(await db.from('community_channel_participants').select('user_id')
                .eq('channel_id', channel.id).eq('user_id', row.user_id).maybeSingle());
            const user = checked(await db.from('users').select('id,status,fcm_token,role,is_master')
                .eq('id', row.user_id).maybeSingle());
            if (!user || ['deleted', 'withdrawn'].includes(user.status)) return finish(row, 'SKIPPED', 'account_unavailable');
            const hostProgram = !membership && channel.source_notice_id
                ? checked(await db.from('notices').select('is_challenge,host_id,host_ids,hosts')
                    .eq('id', channel.source_notice_id).maybeSingle()) : null;
            const registeredHost = isRegisteredChallengeHost(hostProgram, row.user_id);
            if (!membership && !registeredHost && !(channel.is_open_program && authorCommentAvailable) && !(authorCommentAvailable
                && (user.is_master || ['admin', 'master'].includes(String(user.role || '').toLowerCase()))))
                return finish(row, 'SKIPPED', 'membership_ended');
            const { data: registered, error: deviceError } = await db.from('push_devices')
                .select('id,provider,credential,browser,failure_count,enabled').eq('user_id', row.user_id);
            if (deviceError && deviceError.code !== '42P01') throw deviceError;
            const devices = deviceError ? [] : registered || [];
            const enabled = devices.filter(device => device.enabled);
            const fcm = enabled.filter(device => device.provider === 'FCM' && device.credential?.token)
                .map(device => ({ token: device.credential.token, device }));
            if (!devices.length) fcm.push(...parseTokens(user.fcm_token).map(token => ({ token, device: null })));
            const standard = enabled.filter(device => device.provider === 'WEB_PUSH' && device.credential?.endpoint);
            if (!fcm.length && !standard.length) return finish(row, 'SKIPPED', 'no_registered_device');
            const sendWindow = communityPushWindow(now());
            if (!sendWindow.allowed) return defer(row, sendWindow.nextSendAt);
            const channelName = String(channel.name || '커뮤니티').slice(0, 35);
            const title = row.kind === 'comment'
                ? mentionAvailable && !authorCommentAvailable ? `${channelName} 댓글에서 회원님을 태그했어요` : `${channelName}에서 내 글에 댓글이 달렸어요`
                : row.kind === 'digest' && post && commentAvailable
                    ? `${channelName}에 밤사이 ${postLabel}${postLabel === '공지' ? '와' : '과'} 댓글이 올라왔어요`
                    : row.kind === 'digest' && commentAvailable
                        ? mentionAvailable && !authorCommentAvailable ? `${channelName}에 밤사이 댓글 태그가 있어요` : `${channelName}에서 내 글에 밤사이 댓글이 달렸어요`
                        : row.kind === 'digest'
                            ? postLabel === '공지' ? `${channelName}에 밤사이 공지가 등록됐어요` : `${channelName}에 밤사이 ${postLabel}이 올라왔어요`
                            : post?.is_announcement ? `${channelName}에 공지가 등록됐어요` : `${channelName}에 새 글이 올라왔어요`;
            const body = row.kind === 'digest' && post && commentAvailable
                ? `밤사이 올라온 ${postLabel}${postLabel === '공지' ? '와' : '과'} 댓글을 확인해 보세요.`
                : row.kind === 'digest' && commentAvailable
                    ? '밤사이 도착한 댓글을 확인해 보세요.'
                    : row.kind === 'digest' ? `밤사이 올라온 ${postLabel}${postLabel === '공지' ? '를' : '을'} 확인해 보세요.`
                        : row.kind === 'comment' ? '새 댓글을 확인해 보세요.'
                            : post?.is_announcement ? '커뮤니티에서 공지를 확인해 보세요.' : '커뮤니티에서 새 글을 확인해 보세요.';
            const targetPostId = row.kind === 'digest' ? null : post?.id;
            const link = `${origin}/community/${encodeURIComponent(channel.id)}?from=push${targetPostId ? `&post=${encodeURIComponent(targetPostId)}` : ''}`;
            const results = [];
            if (fcm.length) {
                const firebase = await getFirebaseAccess();
                const authWindow = communityPushWindow(now());
                if (!authWindow.allowed) return defer(row, authWindow.nextSendAt);
                results.push(...await Promise.all(fcm.map(async ({ token, device }) => {
                    try {
                        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${firebase.projectId}/messages:send`, {
                            method: 'POST', headers: { Authorization: `Bearer ${firebase.access}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: { token, notification: { title, body },
                                data: { url: link }, webpush: { fcm_options: { link } } } }),
                            signal: AbortSignal.timeout(5000),
                        });
                        return { ok: response.ok, device, code: response.ok ? null : `fcm_${response.status}`,
                            transient: [429, 500, 503].includes(response.status) };
                    } catch { return { ok: false, device, code: 'transport_unknown', transient: true }; }
                })));
            }
            if (standard.length) {
                const webWindow = communityPushWindow(now());
                if (!webWindow.allowed) {
                    if (results.some(result => result.ok)) return finish(row, 'SENT');
                    return defer(row, webWindow.nextSendAt);
                }
                const publicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY')?.trim();
                const privateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY')?.trim();
                if (!publicKey || !privateKey) throw new Error('web_push_credentials_unavailable');
                webpush.setVapidDetails(Deno.env.get('WEB_PUSH_VAPID_SUBJECT')?.trim()
                    || 'mailto:admin@schoolchurchimpact.org', publicKey, privateKey);
                results.push(...await Promise.all(standard.map(async device => {
                    try {
                        const response = await webpush.sendNotification(device.credential,
                            JSON.stringify({ notification: { title, body }, data: { url: link } }),
                            { TTL: 86400, contentEncoding: device.browser === 'Samsung Internet' ? 'aesgcm' : 'aes128gcm' });
                        return { ok: response.statusCode >= 200 && response.statusCode < 300, device,
                            code: String(response.statusCode), transient: response.statusCode >= 500 };
                    } catch (error) {
                        return { ok: false, device, code: String(error?.statusCode || 'web_push_failed'),
                            transient: !error?.statusCode || error.statusCode >= 500 };
                    }
                })));
            }
            await Promise.all(results.filter(result => result.device).map(result =>
                db.from('push_devices').update(result.ok
                    ? { last_success_at: new Date().toISOString(), failure_count: 0, last_failure_code: null }
                    : { failure_count: Number(result.device.failure_count || 0) + 1,
                        last_failure_code: result.code,
                        ...(['fcm_404', 'fcm_410', '404', '410'].includes(result.code) ? { enabled: false } : {}) })
                    .eq('id', result.device.id)));
            if (results.some(result => result.ok)) return finish(row, 'SENT');
            if (results.some(result => result.transient)) return finish(row, 'FAILED', 'delivery_retry');
            return finish(row, 'SKIPPED', 'device_rejected');
        } catch (error) {
            return finish(row, 'FAILED', String(error?.code || 'delivery_failed').slice(0, 100));
        }
    };
    const pending = [...claimed];
    await Promise.all(Array.from({ length: Math.min(5, pending.length) }, async () => {
        while (pending.length) await deliver(pending.shift());
    }));
    return { claimed: claimed.length, sent, skipped, failed, deferred };
};
