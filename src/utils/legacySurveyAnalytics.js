import { isAdminOrStaff } from './userUtils.js';

const responseType = response => response.survey_type || 'CHECKIN';
const responseDay = value => value
    ? new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    : 'unknown';

export function countLegacySurveyResponses({ surveys = [], responses = [], visitNotes = [], users = [], notices = [] }) {
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

    const seenDailyCheckins = new Set();
    const eligible = [...responses]
        .filter(row => !excluded(row))
        .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
        .filter(row => {
            if (responseType(row) !== 'CHECKIN' || !row.user_id) return true;
            const key = `${row.survey_id || 'legacy-checkin'}:${row.user_id}:${responseDay(row.created_at)}`;
            if (seenDailyCheckins.has(key)) return false;
            seenDailyCheckins.add(key);
            return true;
        });

    let checkoutConfig = {};
    const checkoutNotice = notices.find(notice => notice.category === 'SYSTEM' && notice.title === 'CHECKOUT_SURVEY_CONFIG');
    try { checkoutConfig = checkoutNotice?.content ? JSON.parse(checkoutNotice.content) : {}; } catch { checkoutConfig = {}; }
    const checkoutOptions = new Set((checkoutConfig.options || []).map(option => String(option.label || '').trim()).filter(Boolean));
    const existingCheckoutDays = new Set(eligible
        .filter(row => responseType(row) === 'CHECKOUT')
        .map(row => `${row.user_id || ''}:${responseDay(row.created_at)}`));
    const restoredCheckoutCount = visitNotes
        .filter(note => note.user_id && String(note.purpose || '').trim() && !excluded(note))
        .filter(note => !existingCheckoutDays.has(`${note.user_id}:${String(note.visit_date || '').slice(0, 10)}`))
        .filter(note => String(note.purpose).split(',').some(value => checkoutOptions.has(value.trim())))
        .length;

    return Object.fromEntries(surveys.map(survey => {
        const count = survey.is_legacy
            ? eligible.filter(row => !row.survey_id && responseType(row) === survey.survey_type).length
                + (survey.survey_type === 'CHECKOUT' ? restoredCheckoutCount : 0)
            : eligible.filter(row => row.survey_id === survey.id).length;
        return [survey.id, count];
    }));
}
