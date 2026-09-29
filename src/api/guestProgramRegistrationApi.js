import { supabase } from '../supabaseClient';

const missingRpc = error => error?.code === 'PGRST202' || error?.code === '42883';

// The RPC and insert-only relation invoke the same database transaction:
// verify/update/create guest, then apply to exactly one program or session.
// Never fall back to separate users + response writes.
export const guestProgramRegistrationApi = {
    async register({ noticeId = null, sessionId = null, profile, answers = {} }) {
        if (Boolean(noticeId) === Boolean(sessionId)) {
            throw new Error('신청 대상을 확인해 주세요.');
        }
        const { data, error } = await supabase.rpc('register_guest_program_application', {
            p_notice_id: noticeId,
            p_session_id: sessionId,
            p_profile: profile,
            p_answers: answers,
        });
        if (!error) return data;
        if (!missingRpc(error)) throw error;

        const { data: fallback, error: fallbackError } = await supabase
            .from('guest_program_registration_requests')
            .insert({ notice_id: noticeId, session_id: sessionId,
                profile, application_answers: answers })
            .select('status,user_id,had_prior_guest_applications,guest_user')
            .single();
        if (fallbackError) throw fallbackError;
        return fallback;
    },
};
