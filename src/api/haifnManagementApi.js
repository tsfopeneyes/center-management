import { supabase } from '../supabaseClient';

const assert = ({ data, error }) => {
    if (error) throw error;
    return data;
};

export const haifnManagementApi = {
    async pendingCount(userId) {
        const { count, error } = await supabase.from('haifn_chat_operator_notifications')
            .select('message_id,haifn_chat_messages!inner(haifn_chat_sessions!inner(moderation))', { count: 'exact', head: true })
            .eq('haifn_chat_messages.haifn_chat_sessions.moderation', 'NORMAL')
            .eq('operator_id', userId).is('read_at', null);
        if (error) throw error;
        return count || 0;
    },
    async markRead(userId, messages) {
        const ids = messages.map(message => message.id);
        if (!ids.length) return;
        assert(await supabase.from('haifn_chat_operator_notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('operator_id', userId).is('read_at', null).in('message_id', ids));
    },
    async isOperator(userId) {
        const result = await supabase.from('haifn_chat_operators').select('user_id').eq('user_id', userId).maybeSingle();
        return Boolean(assert(result));
    },

    async listSessions() {
        const sessions = assert(await supabase.from('haifn_chat_sessions')
            .select('id,status,assigned_to,created_at,updated_at,moderation,moderation_reason')
            .order('updated_at', { ascending: false }).limit(100)) || [];
        if (!sessions.length) return [];
        const messages = assert(await supabase.from('haifn_chat_messages')
            .select('id,session_id,sender,sender_id,body,created_at')
            .in('session_id', sessions.map(session => session.id))
            .order('created_at', { ascending: false }).limit(500)) || [];
        const latest = new Map();
        messages.forEach(message => { if (!latest.has(message.session_id)) latest.set(message.session_id, message); });
        return sessions.map(session => ({ ...session, lastMessage: latest.get(session.id) || null }));
    },

    async listMessages(sessionId) {
        return assert(await supabase.from('haifn_chat_messages')
            .select('id,session_id,sender,sender_id,body,created_at')
            .eq('session_id', sessionId).order('created_at', { ascending: true }).limit(300)) || [];
    },

    async operatorNames() {
        const operators = assert(await supabase.from('haifn_chat_operators').select('user_id')) || [];
        if (!operators.length) return {};
        const profiles = assert(await supabase.from('users').select('id,name').in('id', operators.map(row => row.user_id))) || [];
        return Object.fromEntries(profiles.map(profile => [profile.id, profile.name]));
    },

    async reply(sessionId, userId, body) {
        const content = body.trim();
        if (!content || content.length > 1000) throw new Error('답변은 1~1000자로 입력해 주세요.');
        assert(await supabase.from('haifn_chat_messages').insert({
            session_id: sessionId, sender: 'STAFF', sender_id: userId, body: content,
        }));
    },

    async setModeration(sessionId, moderation) {
        assert(await supabase.from('haifn_chat_sessions').update({ moderation, moderation_reason: null }).eq('id', sessionId));
    },
    async setStatus(sessionId, status, assignedTo) {
        assert(await supabase.from('haifn_chat_sessions').update({
            status, assigned_to: assignedTo, updated_at: new Date().toISOString(),
        }).eq('id', sessionId));
    },
};
