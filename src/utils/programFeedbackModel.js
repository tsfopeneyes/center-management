import { legacyDefinition } from './surveyModel.js';

export function feedbackRating(row) {
    if (row.snapshot) {
        const q = row.snapshot.questions?.find(q => q.metric === 'satisfaction');
        const value = q ? row.answers?.[q.id] : null;
        return typeof value === 'number' && value >= 1 && value <= 5 ? value : null;
    }
    const custom = row.notices?.guest_properties?.custom_feedback_config || row.notices?.custom_feedback_config;
    if (custom?.questions?.length) {
        // Legacy custom rows contain synthetic q3=5 values. Never count those.
        const index = custom.questions.findIndex(q => q.type === 'star' && (q.metric === 'satisfaction' || /만족/.test(q.title)));
        if (index < 0) return null;
        let answers; try { answers = JSON.parse(row.q8_additional_comments); } catch { return null; }
        const question = custom.questions[index];
        const key = question.id && custom.questions.filter(q => q.id === question.id).length === 1 ? question.id : `q_idx_${index}`;
        const value = answers?.[key];
        return typeof value === 'number' && value >= 1 && value <= 5 ? value : null;
    }
    return typeof row.q3_satisfaction === 'number' && row.q3_satisfaction >= 1 && row.q3_satisfaction <= 5 ? row.q3_satisfaction : null;
}
export function normalizeFeedback(row) {
    return { ...row, _surveyEntry: !!row.snapshot, q3_satisfaction: feedbackRating(row), q8_additional_comments: row.snapshot ? JSON.stringify(row.answers) : row.q8_additional_comments };
}
export function legacyFeedbackDisplay(row, notice) {
    if (row.snapshot) return row;
    const config = notice?.guest_properties?.custom_feedback_config || notice?.custom_feedback_config;
    if (config?.questions?.length) {
        const snapshot = legacyDefinition(config, `${notice?.title || '프로그램'} 피드백`);
        let parsed = {}; try { parsed = JSON.parse(row.q8_additional_comments) || {}; } catch { /* Historical free text is not JSON. */ }
        const answers = {};
        config.questions.forEach((q,i) => { const key = q.id && config.questions.filter(other => other.id === q.id).length === 1 ? q.id : `q_idx_${i}`; const answer = parsed[key] ?? parsed[`q${i+1}`]; if (answer != null) answers[snapshot.questions[i].id] = answer; });
        return { ...row, snapshot, answers, legacy: true };
    }
    const fields = { q1_reason: '참여 이유', q2_experience: '경험', q3_satisfaction: '만족도', q4_best_moment: '가장 좋았던 순간', q5_disappointments: '아쉬웠던 점', q6_would_rejoin: '재참여 의사', q7_rejoin_reason: '재참여 또는 망설이는 이유', q8_additional_comments: '추가 의견' };
    return { ...row, legacy: true, snapshot: { title: '기존 프로그램 피드백', questions: Object.entries(fields).map(([id,title])=>({id,title,type:'text'})) }, answers: Object.fromEntries(Object.keys(fields).map(key=>[key,row[key]])) };
}
