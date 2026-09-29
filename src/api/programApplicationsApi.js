import { supabase } from '../supabaseClient';

const missingRpc = error => error?.code === 'PGRST202' || error?.code === '42883';

// Both fallbacks are insert-only relations whose database triggers invoke the
// same locked transition as the RPC. Do not fall back to notice_responses:
// direct writes cannot atomically enforce capacity and waitlist promotion.
export const programApplicationsApi = {
    async respondMember(noticeId, userId, action, answers = {}, expectedRevision = null) {
        if (action !== 'CANCEL' && !Number.isInteger(expectedRevision)) {
            throw new Error('신청 질문을 다시 불러온 뒤 신청해 주세요.');
        }
        const { data, error } = await supabase.rpc('respond_to_program_application_checked', {
            p_notice_id: noticeId,
            p_user_id: userId,
            p_action: action,
            p_answers: answers,
            p_expected_revision: expectedRevision,
        });
        if (!error) return data;
        if (!missingRpc(error)) throw error;

        const { data: fallback, error: fallbackError } = await supabase
            .from('member_program_application_checked_requests')
            .insert({ notice_id: noticeId, user_id: userId, action,
                application_answers: answers, expected_revision: expectedRevision })
            .select('status')
            .single();
        if (fallbackError) throw fallbackError;
        return fallback;
    },

    async cancelByStaff(noticeId, userId) {
        const { data, error } = await supabase.rpc('cancel_program_application_by_staff', {
            p_notice_id: noticeId,
            p_user_id: userId,
        });
        if (!error) return data;
        if (!missingRpc(error)) throw error;

        const { data: fallback, error: fallbackError } = await supabase
            .from('staff_program_application_cancellations')
            .insert({ notice_id: noticeId, user_id: userId })
            .select('status')
            .single();
        if (fallbackError) throw fallbackError;
        return fallback;
    },
};
