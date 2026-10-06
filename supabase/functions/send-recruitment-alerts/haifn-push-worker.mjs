export const inHaifnHours = date => {
    const local = new Date(date.getTime() + 9 * 3600000);
    return ![0, 6].includes(local.getUTCDay()) && local.getUTCHours() >= 10 && local.getUTCHours() < 18;
};
const checked = result => { if (result.error) throw result.error; return result.data; };

export async function deliverHaifnChatPush({ db, sendUser, now = () => new Date() }) {
    if (!inHaifnHours(now())) return { sent: 0 };
    const due = checked(await db.from('haifn_chat_push_deliveries').select('*')
        .in('state', ['PENDING', 'FAILED']).lte('next_attempt_at', now().toISOString())
        .lt('attempts', 5).order('next_attempt_at').limit(40));
    let sent = 0;
    for (const row of due) {
        if (!inHaifnHours(now())) break;
        const claim = checked(await db.from('haifn_chat_push_deliveries').update({
            state: 'SENDING', attempts: row.attempts + 1, updated_at: now().toISOString(),
        }).eq('id', row.id).eq('state', row.state).eq('attempts', row.attempts).select('id').maybeSingle());
        if (!claim) continue;
        try {
            const session = checked(await db.from('haifn_chat_sessions').select('id,status,moderation').eq('id', row.session_id).maybeSingle());
            const reply = checked(await db.from('haifn_chat_messages').select('id').eq('session_id', row.session_id)
                .eq('sender', 'STAFF').gte('created_at', row.question_at).limit(1));
            const operator = checked(await db.from('haifn_chat_operators').select('user_id').eq('user_id', row.recipient_id).maybeSingle());
            const preferences = checked(await db.from('dm_push_preferences').select('enabled').eq('user_id', row.recipient_id).maybeSingle());
            const localDay = date => new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
            const superseded = row.kind === 'NEW' && localDay(new Date(row.question_at)) !== localDay(now());
            const cancelled = !session || (session.status === 'DONE' || session.moderation === 'FILTERED') || reply.length || !operator || superseded;
            let result = { state: cancelled ? 'CANCELLED' : 'SKIPPED', code: cancelled ? 'resolved' : 'preference_disabled' };
            if (!cancelled && preferences?.enabled !== false && inHaifnHours(now())) {
                result = await sendUser(row.recipient_id, {
                    title: '하이픈 방문자 문의',
                    body: row.kind === 'REMINDER' ? '아직 답변하지 않은 방문자 문의가 있어요.' : '새 방문자 문의가 도착했어요.',
                    link: '/?dm=management', tag: `haifn-${row.session_id}`,
                    ttl: Math.max(1, Math.floor((Date.UTC(now().getUTCFullYear(), now().getUTCMonth(), now().getUTCDate(), 9) - now().getTime()) / 1000)),
                });
            }
            checked(await db.from('haifn_chat_push_deliveries').update({
                state: result.state === 'SENT' ? 'SENT' : result.state === 'FAILED' ? (row.attempts < 4 ? 'FAILED' : 'DEAD') : result.state,
                next_attempt_at: new Date(now().getTime() + 60000).toISOString(),
                updated_at: now().toISOString(), last_error_code: result.code || null,
            }).eq('id', row.id).eq('state', 'SENDING'));
            if (result.state === 'SENT') sent++;
        } catch (error) {
            checked(await db.from('haifn_chat_push_deliveries').update({ state: row.attempts < 4 ? 'FAILED' : 'DEAD',
                updated_at: now().toISOString(), next_attempt_at: new Date(now().getTime() + 60000).toISOString(),
                last_error_code: String(error?.message || 'delivery_failed').slice(0, 100),
            }).eq('id', row.id).eq('state', 'SENDING'));
        }
    }
    return { sent };
}
