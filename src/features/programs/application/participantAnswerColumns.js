import { applicationAnswerEntries } from './applicationAnswerDisplay.js';

const audienceOf = value => ['MEMBER', 'GUEST', 'ALL'].includes(value) ? value : null;
const keyFor = entry => `${entry.id}:${entry.label}:${audienceOf(entry.audience) || ''}`;
const fallbackFields = (currentQuestions, legacyFields) => {
    const currentIds = new Set(currentQuestions.map(question => String(question.id)));
    return [...currentQuestions, ...legacyFields.filter(field => !currentIds.has(String(field.id)))];
};

export const questionAudienceLabel = audience => ({ MEMBER: '회원', GUEST: '비회원', ALL: '공통' })[audienceOf(audience)] || '대상 미지정';

export function participantAnswerColumns(_participants, legacyFields = [], currentQuestions = null) {
    const configured = Array.isArray(currentQuestions) ? currentQuestions : legacyFields;
    return configured.filter(question => question?.id && String(question.label || '').trim()).map((question, index) => ({
        key: keyFor(question), id: question.id, label: question.label,
        audience: audienceOf(question.audience), shortLabel: `Q${index + 1}`,
    }));
}

export function participantAnswerDetails(participant, legacyFields = [], currentQuestions = null) {
    const configured = Array.isArray(currentQuestions) ? currentQuestions : legacyFields;
    const currentKeys = new Set(configured.map(keyFor));
    const entries = applicationAnswerEntries(participant, fallbackFields(configured, legacyFields));
    return entries.filter(entry => !currentKeys.has(keyFor(entry))
        && (entry.definitionKnown || !configured.some(question => String(question.id) === String(entry.id) && question.label === entry.label)));
}

export function participantAnswerCellStates(participant, columns, legacyFields = [], currentQuestions = null) {
    const configured = Array.isArray(currentQuestions) ? currentQuestions : legacyFields;
    const entries = applicationAnswerEntries(participant, fallbackFields(configured, legacyFields));
    const byKey = new Map(entries.map(entry => [keyFor(entry), entry.answer]));
    const audience = audienceOf(participant.application_audience);
    return columns.map(column => {
        // Older unsnapshotted answers have an unknown audience. Match by ID and
        // wording only, but never infer the applicant's audience from today's account.
        const legacy = entries.find(entry => !entry.definitionKnown && String(entry.id) === String(column.id) && entry.label === column.label);
        const answer = byKey.get(column.key) ?? legacy?.answer ?? null;
        if (answer !== null) return { kind: 'answered', answer };
        if (audience && column.audience && column.audience !== 'ALL' && column.audience !== audience) {
            return { kind: 'not_applicable', answer: null };
        }
        return { kind: 'blank', answer: null, audienceUnknown: !audience };
    });
}

export function participantAnswerCells(participant, columns, legacyFields = [], currentQuestions = null) {
    return participantAnswerCellStates(participant, columns, legacyFields, currentQuestions).map(cell => cell.answer);
}

export function sortParticipantsByAnswer(participants, column, direction, legacyFields = [], currentQuestions = null) {
    if (!column || !direction) return participants;
    const indexed = participants.map((participant, index) => ({
        participant, index,
        answer: participantAnswerCells(participant, [column], legacyFields, currentQuestions)[0],
    }));
    indexed.sort((left, right) => {
        const leftBlank = left.answer == null || String(left.answer).trim() === '';
        const rightBlank = right.answer == null || String(right.answer).trim() === '';
        if (leftBlank !== rightBlank) return leftBlank ? 1 : -1;
        if (leftBlank) return left.index - right.index;
        const comparison = String(left.answer).localeCompare(String(right.answer), 'ko', { numeric: true, sensitivity: 'base' });
        return (direction === 'desc' ? -comparison : comparison) || left.index - right.index;
    });
    return indexed.map(item => item.participant);
}
