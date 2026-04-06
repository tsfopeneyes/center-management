import { supabase } from '../supabaseClient';

export const feedbackApi = {
    async fetchUserFeedbacks(userId) {
        const { data, error } = await supabase
            .from('program_feedback')
            .select('*')
            .eq('user_id', userId);
        if (error) throw error;
        return data;
    },

    async fetchFeedbackByNotice(noticeId) {
        const { data, error } = await supabase
            .from('program_feedback')
            .select(`
                *,
                users (
                    id, name, school
                )
            `)
            .eq('notice_id', noticeId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async upsertFeedback(feedbackData) {
        const payload = {
            ...feedbackData,
            updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase
            .from('program_feedback')
            .upsert(payload, { onConflict: 'notice_id, user_id' })
            .select()
            .single();
        if (error) throw error;
        return data;
    }
};
