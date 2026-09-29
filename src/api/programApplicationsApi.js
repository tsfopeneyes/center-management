import { supabase } from '../supabaseClient';

const missingRpc = error => error?.code === 'PGRST202' || error?.code === '42883';

// Both fallbacks are insert-only relations whose database triggers invoke the
// same locked transition as the RPC. Do not fall back to notice_responses:
// direct writes cannot atomically enforce capacity and waitlist promotion.
export const programApplicationsApi = {
    async respondMember(noticeId, userId, action, answers = {}) {
        const { data, error } = await supabase.rpc('respond_to_program_application', {
            p_notice_id: noticeId,
            p_user_id: userId,
            p_action: action,
            p_answers: answers,
        });
        if (!error) return data;
        if (!missingRpc(error)) throw error;

        const { data: fallback, error: fallbackError } = await supabase
            .from('member_program_applications')
            .insert({ notice_id: noticeId, user_id: userId, action, application_answers: answers })
            .select('status')
            .single();
        if (fallbackError) throw fallbackError;
        return fallback;
    },

    async applyGuest(noticeId, guest, answers = {}) {
        const { data, error } = await supabase.rpc('apply_guest_program_application', {
            p_notice_id: noticeId,
            p_user_id: guest.id,
            p_name: guest.name,
            p_phone: guest.phone,
            p_birth: guest.birth,
            p_answers: answers,
        });
        if (!error) return data;
        if (!missingRpc(error)) throw error;

        const { data: fallback, error: fallbackError } = await supabase
            .from('guest_program_applications')
            .insert({ notice_id: noticeId, user_id: guest.id, name: guest.name,
                phone: guest.phone, birth: guest.birth, application_answers: answers })
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
