import { isAdminOrStaff } from './userUtils.js';

const responseType = response => response.survey_type || 'CHECKIN';
const responseDay = value => value
    ? new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    : 'unknown';
const questionOf = config => String(config?.question || config?.qaQuestion || config?.title || config?.questions?.[0]?.title || '').trim();
const normalizedQuestion = value => String(value || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const bigrams = value => {
    const normalized = normalizedQuestion(value);
    return normalized.length < 2 ? [normalized] : Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2));
};
const questionSimilarity = (left, right) => {
    const a = bigrams(left), b = bigrams(right);
    if (!a[0] || !b[0]) return 0;
    const remaining = [...b];
    let overlap = 0;
    a.forEach(value => { const index = remaining.indexOf(value); if (index >= 0) { overlap += 1; remaining.splice(index, 1); } });
    return (2 * overlap) / (a.length + b.length);
};
const snapshotMatches = (row, survey) => {
    const savedQuestion = questionOf(row.survey_snapshot);
    return !!savedQuestion && questionSimilarity(savedQuestion, questionOf(survey.config) || survey.title) >= 0.72;
};

export function legacySurveyResponsesForSurvey({ survey, responses = [], visitNotes = [], users = [], notices = [] }) {
    const userMap = new Map(users.map(user => [user.id, user]));
    const excludedNames = new Set(['김학생', 'admin', 'jin']);
    const excluded = row => {
        const user = userMap.get(row.user_id);
        const name = String(user?.name || '').trim().toLowerCase();
        return row.aggregation_excluded === true
            || isAdminOrStaff(user)
            || excludedNames.has(name)
            || name.includes('테스트');
    };

    const eligible = [...responses]
        .filter(row => !excluded(row))
        .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

    let checkoutConfig = {};
    const checkoutNotice = notices.find(notice => notice.category === 'SYSTEM' && notice.title === 'CHECKOUT_SURVEY_CONFIG');
    try { checkoutConfig = checkoutNotice?.content ? JSON.parse(checkoutNotice.content) : {}; } catch { checkoutConfig = {}; }
    const checkoutOptions = new Set((checkoutConfig.options || []).map(option => String(option.label || '').trim()).filter(Boolean));
    const existingCheckoutDays = new Set(eligible
        .filter(row => responseType(row) === 'CHECKOUT')
        .map(row => `${row.user_id || ''}:${responseDay(row.created_at)}`));
    const restoredCheckout = visitNotes
        .filter(note => note.user_id && String(note.purpose || '').trim() && !excluded(note))
        .filter(note => !existingCheckoutDays.has(`${note.user_id}:${String(note.visit_date || '').slice(0, 10)}`))
        .filter(note => String(note.purpose).split(',').some(value => checkoutOptions.has(value.trim())))
        .map((note, index) => ({
            ...note,
            id: `restored-checkout-${note.id || `${note.user_id}-${note.visit_date}-${index}`}`,
            created_at: note.created_at || `${String(note.visit_date).slice(0, 10)}T12:00:00+09:00`,
            survey_type: 'CHECKOUT',
            survey_id: null,
            selections: String(note.purpose).split(',').map(value => value.trim()).filter(value => checkoutOptions.has(value)),
            restored_from_visit_note: true,
        }));

    const routedRows = eligible.filter(row => {
        if (String(row.survey_id || '') === String(survey.id)) return true;
        if (row.survey_id || responseType(row) !== survey.survey_type) return false;
        const hasSnapshotQuestion = !!questionOf(row.survey_snapshot);
        return survey.is_legacy ? !hasSnapshotQuestion || snapshotMatches(row, survey) : snapshotMatches(row, survey);
    });
    const seenDailyCheckins = new Set();
    const rows = routedRows.filter(row => {
        if (responseType(row) !== 'CHECKIN' || !row.user_id) return true;
        const key = `${row.user_id}:${responseDay(row.created_at)}`;
        if (seenDailyCheckins.has(key)) return false;
        seenDailyCheckins.add(key);
        return true;
    });
    return survey.is_legacy && survey.survey_type === 'CHECKOUT' ? [...rows, ...restoredCheckout] : rows;
}

export function countLegacySurveyResponses({ surveys = [], responses = [], visitNotes = [], users = [], notices = [] }) {
    return Object.fromEntries(surveys.map(survey => [survey.id, legacySurveyResponsesForSurvey({ survey, responses, visitNotes, users, notices }).length]));
}
