import { supabase } from '../supabaseClient';
import { getKstDateString } from '../utils/dailyProgramSessions';

const missingTable = (error) => error?.code === '42P01' || error?.code === 'PGRST205';
const missingRpc = (error) => error?.code === 'PGRST202' || error?.code === '42883';

export const programSessionsApi = {
    async fetchAdminParticipants(sessionId) {
        const { data, error } = await supabase.rpc('get_program_session_participants', {
            p_session_id: sessionId,
        });
        if (!error) return Array.isArray(data) ? data : [];
        if (!missingRpc(error)) throw error;

        // Direct-table fallback for deployments whose RPC schema cache has not refreshed yet.
        const { data: fallback, error: fallbackError } = await supabase
            .from('daily_program_session_responses')
            .select('user_id,status,is_attended,created_at,application_answers,users(id,name,school,phone,phone_back4,is_leader,user_group)')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });
        if (fallbackError) throw fallbackError;
        return (fallback || []).map(response => ({
            ...response,
            user: response.users || null,
        }));
    },

    async fetchToday(noticeIds = [], userId = null) {
        if (!noticeIds.length) return {};
        const today = getKstDateString();
        const { data, error } = await supabase
            .from('daily_program_sessions')
            .select('*, daily_program_session_responses(user_id,status,is_attended,created_at,users(id,name,school))')
            .in('notice_id', noticeIds)
            .eq('session_date', today)
            .is('voided_at', null);
        if (error) {
            if (missingTable(error)) return {};
            throw error;
        }
        return Object.fromEntries((data || []).map(session => {
            const responses = session.daily_program_session_responses || [];
            return [session.notice_id, {
                ...session,
                join_count: Number(session.join_count) || 0,
                my_response: responses.find(item => item.user_id === userId) || null,
            }];
        }));
    },

    async fetchOpen(noticeIds = [], userId = null) {
        if (!noticeIds.length) return {};
        const { data, error } = await supabase
            .from('daily_program_sessions')
            .select('*, daily_program_session_responses(user_id,status,is_attended,created_at,users(id,name,school))')
            .in('notice_id', noticeIds)
            .eq('status', 'OPEN')
            .gte('starts_at', new Date().toISOString())
            .is('voided_at', null)
            .order('starts_at', { ascending: true });
        if (error) {
            if (missingTable(error)) return {};
            throw error;
        }
        const grouped = {};
        for (const session of data || []) {
            const responses = session.daily_program_session_responses || [];
            const joinCount = responses.filter(item => item.status === 'JOIN').length;
            const waitlistCount = responses.filter(item => item.status === 'WAITLIST').length;
            const enriched = { ...session,
                // Derive the card counts from the current response rows. The
                // stored join_count can lag behind when an application is cancelled.
                join_count: joinCount,
                waitlist_count: waitlistCount,
                my_response: responses.find(item => item.user_id === userId) || null };
            (grouped[session.notice_id] ||= []).push(enriched);
        }
        const result = Object.fromEntries(Object.entries(grouped).map(([noticeId, sessions]) => [noticeId, {
            ...sessions[0], open_sessions: sessions,
        }]));
        return result;
    },

    async fetchDate(noticeId, sessionDate) {
        const { data, error } = await supabase.from('daily_program_sessions')
            .select('*, daily_program_session_responses(user_id,status,is_attended,created_at,users(id,name,school))')
            .eq('notice_id', noticeId).eq('session_date', sessionDate).is('voided_at', null).maybeSingle();
        if (error) throw error;
        return data;
    },

    async fetchAll(noticeId) {
        const { data, error } = await supabase.from('daily_program_sessions')
            .select('*')
            .eq('notice_id', noticeId)
            .is('voided_at', null)
            .order('session_date', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async closePastSessions(noticeId, today = getKstDateString()) {
        // A past occurrence has ended, even when nobody manually closed it.
        // Keep the session and every response for historical rosters and stats.
        const { data, error } = await supabase.from('daily_program_sessions')
            .update({ status: 'CLOSED', updated_at: new Date().toISOString() })
            .eq('notice_id', noticeId)
            .lt('session_date', today)
            .eq('status', 'OPEN')
            .is('voided_at', null)
            .select('id');
        if (error) throw error;
        return data?.length || 0;
    },

    async fetchManageable(noticeId, today = getKstDateString()) {
        const { data, error } = await supabase.from('daily_program_sessions')
            .select('*')
            .eq('notice_id', noticeId)
            .gte('session_date', today)
            .is('voided_at', null)
            .order('session_date', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async fetchPublicToday(noticeId) {
        const { data, error } = await supabase.from('daily_program_sessions').select('*')
            .eq('notice_id', noticeId).eq('session_date', getKstDateString()).is('voided_at', null).maybeSingle();
        if (error) throw error;
        return data;
    },

    async applyGuest(session, guest, answers = {}) {
        const payload = { p_session_id: session.id, p_user_id: guest.id,
            p_name: guest.name, p_phone: guest.phone, p_birth: guest.birth, p_answers: answers };
        const { data, error } = await supabase.rpc('apply_guest_program_session', payload);
        if (!error) return data;
        if (!missingRpc(error)) throw error;
        // The insert-only view invokes the same guarded transaction as the RPC.
        const { data: fallback, error: fallbackError } = await supabase.from('guest_program_session_applications')
            .insert({ session_id: session.id, user_id: guest.id, name: guest.name,
                phone: guest.phone, birth: guest.birth, application_answers: answers }).select('status').single();
        if (fallbackError) throw fallbackError;
        return fallback;
    },

    async saveSession(notice, values, sessionDate = getKstDateString()) {
        if (sessionDate < getKstDateString()) throw new Error('지난 날짜의 회차는 다시 열 수 없습니다.');
        const startTime = values.start_time || '12:00';
        const sessionFields = (Array.isArray(values.session_fields) ? values.session_fields : [])
            .map(field => ({ id: String(field.id), label: String(field.label).trim(), value: String(field.value || '').trim() }))
            .filter(field => field.label && field.value);
        const sessionHosts = (Array.isArray(values.hosts) ? values.hosts : [])
            .filter(host => host?.host_id)
            .map(host => ({
                host_id: String(host.host_id),
                name: String(host.name || '').trim(),
                one_liner: String(host.one_liner || '').trim(),
            }));
        const payload = {
            notice_id: notice.id,
            session_date: sessionDate,
            starts_at: `${sessionDate}T${startTime}:00+09:00`,
            session_summary: sessionFields[0]?.value || '오늘의 내용',
            session_prompt: sessionFields[1]?.value || null,
            session_fields: [
                ...sessionFields,
                { id: '__session_hosts', type: 'hosts', hosts: sessionHosts },
            ],
            capacity: Math.max(0, Number(values.capacity) || 0),
            status: 'OPEN',
            voided_at: null,
            updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from('daily_program_sessions')
            .upsert(payload, { onConflict: 'notice_id,session_date' }).select().single();
        if (error) throw error;
        return data;
    },

    async saveToday(notice, values) { return this.saveSession(notice, values, getKstDateString()); },

    async closeSession(noticeId, sessionDate = getKstDateString()) {
        const { data: session, error: closeError } = await supabase
            .from('daily_program_sessions')
            .update({ status: 'CLOSED', updated_at: new Date().toISOString() })
            .eq('notice_id', noticeId)
            .eq('session_date', sessionDate)
            .select('id')
            .maybeSingle();
        if (closeError) throw closeError;
        if (!session) return { deleted: false };

        // Close first so no new applications can arrive while deciding whether
        // this session should count as an operated occurrence.
        const { data: responses, error: responsesError } = await supabase
            .from('daily_program_session_responses')
            .select('status,is_attended')
            .eq('session_id', session.id);
        if (responsesError) throw responsesError;

        const hasParticipant = (responses || []).some(response =>
            response.status === 'JOIN' || response.status === 'WAITLIST' || response.is_attended
        );
        if (!hasParticipant) {
            const { error: voidError } = await supabase
                .from('daily_program_sessions')
                .update({ voided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', session.id);
            if (voidError) throw voidError;
            return { voided: true };
        }

        return { voided: false };
    },

    async closeToday(noticeId) { return this.closeSession(noticeId, getKstDateString()); },

    async respond(session, userId, action) {
        const rpcPayload = { p_session_id: session.id, p_user_id: userId, p_action: action };
        const { data, error } = await supabase.rpc('respond_to_program_session', rpcPayload);
        if (!error) return data;
        if (!missingRpc(error)) throw error;

        // Direct-table fallback is intentionally retained for deployments where
        // the RPC cache has not refreshed yet. Database constraints still guard
        // identity, duplicates and closed sessions.
        if (action === 'CANCEL') {
            const { error: fallbackError } = await supabase.from('daily_program_session_responses')
                .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
                .eq('session_id', session.id).eq('user_id', userId);
            if (fallbackError) throw error;
            if (session.capacity > 0) {
                const { count } = await supabase.from('daily_program_session_responses').select('*', { count: 'exact', head: true })
                    .eq('session_id', session.id).eq('status', 'JOIN');
                if ((count || 0) < session.capacity) {
                    const { data: next } = await supabase.from('daily_program_session_responses').select('user_id')
                        .eq('session_id', session.id).eq('status', 'WAITLIST').order('created_at').limit(1).maybeSingle();
                    if (next) await supabase.from('daily_program_session_responses').update({ status: 'JOIN', cancelled_at: null })
                        .eq('session_id', session.id).eq('user_id', next.user_id);
                }
            }
            return { status: 'CANCELLED' };
        }
        if (session.status !== 'OPEN' || Date.now() >= new Date(session.starts_at).getTime()) {
            throw new Error('신청이 마감되었습니다.');
        }
        const status = session.capacity > 0 && session.join_count >= session.capacity ? 'WAITLIST' : 'JOIN';
        const { error: fallbackError } = await supabase.from('daily_program_session_responses')
            .upsert({ session_id: session.id, user_id: userId, status, cancelled_at: null }, { onConflict: 'session_id,user_id' });
        if (fallbackError) throw error;
        return { status };
    },

    async setAttendance(sessionId, userId, attended) {
        const { error } = await supabase.from('daily_program_session_responses')
            .update({ is_attended: attended }).eq('session_id', sessionId).eq('user_id', userId);
        if (error) throw error;
    },
};
