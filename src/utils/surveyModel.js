import { v4 as uuid } from 'uuid';

export const QUESTION_TYPES = { short: '단답형', text: '장문형', choice: '단일 선택', multiple: '복수 선택', star: '별점' };
export function programSurveyEndAt(program) {
    const date = program.program_date;
    const endDate = program.program_end_date;
    if (!date) return endDate ? Date.parse(`${String(endDate).slice(0,10)}T00:00:00+09:00`) + 86400000 : null;
    const start = new Date(date);
    if (!Number.isFinite(start.getTime())) return null;
    const duration = String(program.program_duration || '').trim();
    const hours = duration.match(/([\d.]+)\s*(시간|h)/i), minutes = duration.match(/([\d.]+)\s*(분|m)/i);
    let length = 60;
    if (hours || minutes) length = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
    else if (Number(duration) > 0) length = Number(duration) <= 12 ? Number(duration) * 60 : Number(duration);
    if (!(length > 0)) length = 60;
    const kst = new Date(start.getTime() + 9 * 3600000).toISOString();
    const lastStart = endDate ? Date.parse(`${String(endDate).slice(0,10)}T${kst.slice(11,19)}+09:00`) : start.getTime();
    return lastStart + length * 60000;
}
export const newQuestion = () => ({ id: uuid(), title: '', type: 'short', required: true, options: [], metric: null });
export const optionsOf = q => (Array.isArray(q.options) ? q.options : String(q.options || '').split(',')).map(o => typeof o === 'string' ? o : o.label).filter(Boolean);
export function validateDefinition(definition) {
    if (!definition.title?.trim()) return '설문 제목을 입력해 주세요.';
    if (!definition.questions?.length) return '질문을 하나 이상 추가해 주세요.';
    const ids = new Set();
    for (const q of definition.questions) {
        if (!q.id || ids.has(q.id)) return '질문 식별자가 중복됩니다. 질문을 복제해 다시 추가해 주세요.';
        ids.add(q.id);
        if (!q.title?.trim() || !QUESTION_TYPES[q.type]) return '질문 내용과 유형을 확인해 주세요.';
        if (['choice', 'multiple'].includes(q.type)) {
            const opts = optionsOf(q);
            if (opts.length < 2 || new Set(opts).size !== opts.length) return '선택지는 서로 다른 내용으로 두 개 이상 입력해 주세요.';
        }
        if (q.metric && q.type !== 'star') return '만족도 지표는 별점 질문에만 지정할 수 있습니다.';
    }
    if (definition.questions.filter(q => q.metric === 'satisfaction').length > 1) return '만족도 대표 문항은 하나만 지정해 주세요.';
    return null;
}
export function validateAnswers(definition, answers) {
    for (const q of definition.questions || []) {
        const value = answers[q.id];
        const empty = value == null || value === '' || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);
        if (empty) { if (q.required) return `${q.title}: 답변을 입력해 주세요.`; continue; }
        if (q.type === 'star' && (!Number.isInteger(value) || value < 1 || value > 5)) return `${q.title}: 별점은 1~5점입니다.`;
        if (q.type === 'choice' && !optionsOf(q).includes(value)) return `${q.title}: 선택지를 확인해 주세요.`;
        if (q.type === 'multiple' && (!Array.isArray(value) || new Set(value).size !== value.length || value.some(v => !optionsOf(q).includes(v)))) return `${q.title}: 선택지를 확인해 주세요.`;
        if (['short', 'text'].includes(q.type) && (typeof value !== 'string' || value.length > 5000)) return `${q.title}: 5,000자 이내로 작성해 주세요.`;
    }
    if (Object.keys(answers).some(id => !definition.questions.some(q => q.id === id))) return '설문에 없는 답변이 포함되어 있습니다.';
    return null;
}
export const answerSummary = (definition, answers) => (definition.questions || []).filter(q => answers[q.id] != null).map(q => `${q.title}: ${Array.isArray(answers[q.id]) ? answers[q.id].join(', ') : answers[q.id]}`);
// The signature intentionally includes wording and options: matching positions or
// question IDs alone do not establish that two versions measure the same thing.
export const questionSignature = q => JSON.stringify([q.id, q.title, q.type, optionsOf(q), q.metric || null]);
export function comparePrograms(entries) {
    const groups = new Map();
    for (const entry of entries.filter(e => e.notice_id && !e.aggregation_excluded && !e.legacy)) {
        for (const q of entry.snapshot?.questions || []) {
            const key = questionSignature(q);
            if (!groups.has(key)) groups.set(key, { key, question: q, programs: {} });
            const group = groups.get(key);
            const stats = group.programs[entry.notice_id] ||= { count: 0, sum: 0, choices: {}, texts: [] };
            const value = entry.answers?.[q.id];
            if (value == null || value === '' || (Array.isArray(value) && !value.length)) continue;
            stats.count++;
            if (q.type === 'star') stats.sum += value;
            else if (['choice', 'multiple'].includes(q.type)) for (const option of [].concat(value)) stats.choices[option] = (stats.choices[option] || 0) + 1;
            else stats.texts.push(String(value));
        }
    }
    return [...groups.values()];
}
export function legacyDefinition(config = {}, title = '') {
    if (config.questions?.length) return { title, description: config.description || '', questions: config.questions.map((q, i) => ({ ...q, id: `legacy-${i}-${q.id || ''}`, options: optionsOf(q), required: !!q.required })) };
    const text = ['QUESTION_QA', 'FEEDBACK_QA', 'CHAT_SHOUTOUT'].includes(config.mode);
    const questions = [{ id: 'legacy-main', title: (text ? config.qaQuestion : config.question) || title, type: text ? 'text' : 'multiple', required: true, options: optionsOf(config) }];
    if (config.additionalComment?.enabled) questions.push({ id: 'legacy-comment', type: 'text', title: config.additionalComment.label || '추가 의견', required: !!config.additionalComment.required });
    return { title: title || questions[0].title, description: config.description || '', questions };
}
