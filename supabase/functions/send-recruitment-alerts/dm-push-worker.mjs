const checked = ({ data, error }) => {
    if (error) throw error;
    return data;
};

const parseTokens = value => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(String(value));
        if (Array.isArray(parsed)) return parsed.filter(token => typeof token === 'string' && token);
    } catch {}
    return [String(value)];
};

export const deliverDirectMessagePush = async ({ db, webpush, origin, getFirebaseAccess, now = () => new Date() }) => {
    const currentTime = now();
    const staleBefore = new Date(currentTime.getTime() - 5 * 60 * 1000).toISOString();
    checked(await db.from('dm_push_deliveries').update({
        state: 'FAILED', attempt_id: null, next_attempt_at: currentTime.toISOString(),
        updated_at: currentTime.toISOString(), last_error_code: 'stale_claim_recovered',
    }).eq('state', 'SENDING').lt('updated_at', staleBefore));
    const due = checked(await db.from('dm_push_deliveries').select('*')
        .in('state', ['PENDING', 'FAILED']).lte('next_attempt_at', currentTime.toISOString())
        .lt('attempts', 5).order('next_attempt_at').order('id').limit(40));
    const claimed = [];
    for (const row of due) {
        const attemptId = crypto.randomUUID();
        const claim = checked(await db.from('dm_push_deliveries').update({
            state: 'SENDING', attempt_id: attemptId, attempts: Number(row.attempts || 0) + 1,
            updated_at: now().toISOString(),
        }).eq('id', row.id).eq('state', row.state).eq('attempts', row.attempts).select('*').maybeSingle());
        if (claim) claimed.push(claim);
    }

    let sent = 0, skipped = 0, failed = 0;
    const finish = async (row, state, patch = {}) => {
        checked(await db.from('dm_push_deliveries').update({
            state, attempt_id: null, updated_at: now().toISOString(), ...patch,
        }).eq('id', row.id).eq('attempt_id', row.attempt_id));
        if (state === 'SENT') sent += 1;
        else if (state === 'SKIPPED' || state === 'CANCELLED') skipped += 1;
        else failed += 1;
    };

    const deliver = async row => {
        try {
            const message = checked(await db.from('dm_messages')
                .select('id,message_type,content,revoked_at,sender_id,sender:users!dm_messages_sender_id_fkey(name),conversation:dm_conversations!inner(id,kind,title,status)')
                .eq('id', row.message_id).maybeSingle());
            if (!message || message.revoked_at || message.conversation?.status !== 'ACTIVE') {
                return finish(row, message?.revoked_at ? 'CANCELLED' : 'SKIPPED', { last_error_code: 'message_unavailable' });
            }

            const membership = checked(await db.from('dm_participant_memberships')
                .select('id,joined_as_staff,left_at').eq('conversation_id', row.conversation_id)
                .eq('user_id', row.recipient_id).is('left_at', null).maybeSingle());
            if (!membership) return finish(row, 'SKIPPED', { last_error_code: 'membership_ended' });

            if (membership.joined_as_staff) {
                const staff = checked(await db.from('staff_directory').select('id').eq('id', row.recipient_id).maybeSingle());
                if (!staff) return finish(row, 'SKIPPED', { last_error_code: 'staff_access_changed' });
            }

            const preferences = checked(await db.from('dm_push_preferences').select('*')
                .eq('user_id', row.recipient_id).maybeSingle()) || {
                enabled: true, preview_enabled: false, group_enabled: true,
            };
            if (!preferences.enabled || (message.conversation.kind === 'GROUP' && !preferences.group_enabled)) {
                return finish(row, 'SKIPPED', { last_error_code: 'preference_disabled' });
            }

            const user = checked(await db.from('users').select('id,status,fcm_token')
                .eq('id', row.recipient_id).maybeSingle());
            if (!user || user.status === 'withdrawn') return finish(row, 'SKIPPED', { last_error_code: 'account_unavailable' });

            const { data: registered, error: deviceError } = await db.from('push_devices')
                .select('id,provider,credential,browser,failure_count,enabled').eq('user_id', row.recipient_id);
            if (deviceError && deviceError.code !== '42P01') throw deviceError;
            const devices = deviceError ? [] : registered || [];
            const enabledDevices = devices.filter(device => device.enabled);
            const fcm = enabledDevices.filter(device => device.provider === 'FCM' && device.credential?.token)
                .map(device => ({ token: device.credential.token, device }));
            if (!devices.length) fcm.push(...parseTokens(user.fcm_token).map(token => ({ token, device: null })));
            const standard = enabledDevices.filter(device => device.provider === 'WEB_PUSH' && device.credential?.endpoint);
            if (!fcm.length && !standard.length) return finish(row, 'SKIPPED', {
                device_count: 0, success_count: 0, failure_count: 0, last_error_code: 'no_registered_device',
            });

            const senderName = String(message.sender?.name || '대화 상대').slice(0, 40);
            const title = message.conversation.kind === 'GROUP'
                ? `${String(message.conversation.title || '그룹 대화').slice(0, 40)}: ${senderName}`
                : senderName;
            const body = preferences.preview_enabled
                ? (message.message_type === 'IMAGE' ? '사진을 보냈어요.' : String(message.content || '').replace(/\s+/g, ' ').trim().slice(0, 120))
                : '새 메시지가 도착했어요.';
            const link = `${origin}/?dm=${encodeURIComponent(message.conversation.id)}`;
            const tag = `dm-${message.conversation.id}`;
            const results = [];

            if (fcm.length) {
                const firebase = await getFirebaseAccess();
                results.push(...await Promise.all(fcm.map(async ({ token, device }) => {
                    try {
                        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${firebase.projectId}/messages:send`, {
                            method: 'POST', headers: { Authorization: `Bearer ${firebase.access}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: { token, notification: { title, body },
                                data: { url: link, dmConversationId: String(message.conversation.id), tag },
                                webpush: { notification: { tag }, fcm_options: { link } } } }),
                            signal: AbortSignal.timeout(5000),
                        });
                        return { ok: response.ok, device, code: response.ok ? null : `fcm_${response.status}`,
                            transient: [429, 500, 503].includes(response.status) };
                    } catch { return { ok: false, device, code: 'transport_unknown', transient: true }; }
                })));
            }

            if (standard.length) {
                const publicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY')?.trim();
                const privateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY')?.trim();
                if (!publicKey || !privateKey) throw new Error('web_push_credentials_unavailable');
                webpush.setVapidDetails(Deno.env.get('WEB_PUSH_VAPID_SUBJECT')?.trim()
                    || 'mailto:admin@schoolchurchimpact.org', publicKey, privateKey);
                results.push(...await Promise.all(standard.map(async device => {
                    try {
                        const response = await webpush.sendNotification(device.credential,
                            JSON.stringify({ notification: { title, body, tag },
                                data: { url: link, dmConversationId: String(message.conversation.id), tag } }),
                            { TTL: 3600, contentEncoding: device.browser === 'Samsung Internet' ? 'aesgcm' : 'aes128gcm' });
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
                    ? { last_success_at: now().toISOString(), failure_count: 0, last_failure_code: null }
                    : { failure_count: Number(result.device.failure_count || 0) + 1, last_failure_code: result.code,
                        ...(['fcm_404', 'fcm_410', '404', '410'].includes(result.code) ? { enabled: false } : {}) })
                    .eq('id', result.device.id)));
            const successCount = results.filter(result => result.ok).length;
            const failureCount = results.length - successCount;
            const patch = { device_count: results.length, success_count: successCount, failure_count: failureCount,
                last_error_code: failureCount ? 'partial_device_failure' : null };
            if (successCount) return finish(row, 'SENT', patch);
            if (results.some(result => result.transient)) {
                if (row.attempts < 5) return finish(row, 'FAILED', {
                    ...patch, next_attempt_at: new Date(now().getTime() + 60000).toISOString(),
                });
                return finish(row, 'DEAD', { ...patch, last_error_code: 'retry_exhausted' });
            }
            return finish(row, 'SKIPPED', { ...patch, last_error_code: 'device_rejected' });
        } catch (error) {
            return finish(row, row.attempts < 5 ? 'FAILED' : 'DEAD', {
                next_attempt_at: new Date(now().getTime() + 60000).toISOString(),
                last_error_code: String(error?.message || 'delivery_failed').slice(0, 100),
            });
        }
    };

    const pending = [...claimed];
    await Promise.all(Array.from({ length: Math.min(5, pending.length) }, async () => {
        while (pending.length) await deliver(pending.shift());
    }));
    return { claimed: claimed.length, sent, skipped, failed };
};
