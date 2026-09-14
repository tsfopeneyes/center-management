import { supabase } from '../supabaseClient';
import { missingSurveySchema } from './surveyHubApi';
import { fetchAllPages } from '../utils/fetchAllPages';
import { normalizeFeedback } from '../utils/programFeedbackModel';

async function readFeedbacks({ userId, noticeId } = {}) {
    const filters = query => { if (userId) query = query.eq('user_id', userId); if (noticeId) query = query.eq('notice_id', noticeId); return query; };
    const legacy = await fetchAllPages(() => filters(supabase.from('program_feedback').select('*,users(id,name,school,birth),notices(title,program_type,guest_properties)')).order('created_at', { ascending: false }).order('id'));
    let modern = [];
    try { modern = await fetchAllPages(() => filters(supabase.from('survey_entries').select('*,users(id,name,school,birth),notices(title,program_type,guest_properties)').not('notice_id','is',null)).order('created_at', { ascending: false }).order('id')); }
    catch (e) { if (!missingSurveySchema(e)) throw e; }
    return [...legacy, ...modern].map(normalizeFeedback).sort((a,b)=>b.created_at.localeCompare(a.created_at));
}

export const feedbackApi = {
    async fetchUserFeedbacks(userId) {
        return readFeedbacks({ userId });
    },
    async hasFeedback(noticeId, userId) {
        return (await readFeedbacks({ userId, noticeId })).length > 0;
    },
    async fetchFeedbackByNotice(noticeId) {
        return readFeedbacks({ noticeId });
    },
    async fetchAllFeedbacks() {
        return readFeedbacks();
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
