import { optionsOf } from './surveyModel.js';

const content = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const hasAnswer = value => value != null && value !== '' && (!Array.isArray(value) || value.length > 0);

export function questionContentKey(question) {
    const options = ['choice', 'multiple'].includes(question.type)
        ? optionsOf(question).map(content).sort()
        : [];
    return JSON.stringify([content(question.title), question.type, options, question.metric || null]);
}

export function summarizeSurveyEntries(entries) {
    const groups = new Map();
    for (const entry of entries.filter(row => !row.aggregation_excluded)) {
        const seenQuestions = new Set();
        for (const question of entry.snapshot?.questions || []) {
            const value = entry.answers?.[question.id];
            if (!hasAnswer(value)) continue;
            const key = questionContentKey(question);
            if (seenQuestions.has(key)) continue;
            seenQuestions.add(key);
            if (!groups.has(key)) groups.set(key, { key, question, count: 0, sum: 0, choices: {}, stars: {}, texts: [] });
            const group = groups.get(key);
            group.count += 1;
            if (question.type === 'star') {
                const score = Number(value);
                if (Number.isInteger(score) && score >= 1 && score <= 5) {
                    group.sum += score;
                    group.stars[score] = (group.stars[score] || 0) + 1;
                }
            } else if (['choice', 'multiple'].includes(question.type)) {
                for (const option of new Set([].concat(value).map(content).filter(Boolean))) {
                    group.choices[option] = (group.choices[option] || 0) + 1;
                }
            } else {
                group.texts.push({ value: String(value), name: entry.users?.name || '응답자' });
            }
        }
    }
    return [...groups.values()];
}
