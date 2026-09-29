import { supabase } from '../supabaseClient';

const missingRpc = error => error?.code === 'PGRST202' || error?.code === '42883';

const submit = async (rpc, relation, scope, id, userIds) => {
    const { data, error } = await supabase.rpc(rpc, { [scope]: id, p_user_ids: userIds });
    if (!error) return data;
    if (!missingRpc(error)) throw error;

    // Insert-only relation fallback invokes exactly the same staff-verified
    // transaction; never bypass it with direct response-table upserts.
    const { data: fallback, error: fallbackError } = await supabase
        .from(relation)
        .insert({ [scope === 'p_notice_id' ? 'notice_id' : 'session_id']: id, user_ids: userIds })
        .select('added_count')
        .single();
    if (fallbackError) throw fallbackError;
    return { count: fallback.added_count };
};

export const staffProgramWalkInsApi = {
    addWhole: (noticeId, userIds) => submit('add_staff_program_walkins',
        'staff_program_walkins', 'p_notice_id', noticeId, userIds),
    addSession: (sessionId, userIds) => submit('add_staff_program_session_walkins',
        'staff_program_session_walkins', 'p_session_id', sessionId, userIds),
    async cancelSession(sessionId, userId) {
        const { data, error } = await supabase.rpc('cancel_staff_program_session_application', {
            p_session_id: sessionId,
            p_user_id: userId,
        });
        if (!error) return data;
        if (!missingRpc(error)) throw error;

        const { data: fallback, error: fallbackError } = await supabase
            .from('staff_program_session_cancellations')
            .insert({ session_id: sessionId, user_id: userId })
            .select('status')
            .single();
        if (fallbackError) throw fallbackError;
        return fallback;
    },
};
