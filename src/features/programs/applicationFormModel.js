import { listVisibleLegacyGuestFields, readLegacyGuestFields } from './applicationFields.js';

export const APPLICATION_AUDIENCE = Object.freeze({
    MEMBER: 'MEMBER',
    GUEST: 'GUEST',
    ALL: 'ALL',
});

export const APPLICATION_QUESTION_TYPES = Object.freeze({
    text: '단답형',
    textarea: '장문형',
    select: '선택형',
});

const questionIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const maxQuestions = 30;
const maxLabelLength = 200;
const maxTextLength = 3000;
const maxAnswerBytes = 32768;

// This is a migration adapter, not a rewrite of the stored guest settings.
// Historical question IDs must remain unchanged so existing answer keys match.
const toLegacyGuestQuestion = (field, { trimLabel = true } = {}) => ({
        id: String(field.id),
        label: trimLabel ? String(field.label).trim() : String(field.label || ''),
        type: APPLICATION_QUESTION_TYPES[field.type] ? field.type : 'text',
        required: field.required === true,
        audience: APPLICATION_AUDIENCE.GUEST,
        options: field.type === 'select' && Array.isArray(field.options)
            ? field.options.map(option => String(option).trim()).filter(Boolean)
            : [],
});

export function legacyGuestQuestions(guestProperties) {
    return listVisibleLegacyGuestFields(guestProperties).map(field => toLegacyGuestQuestion(field));
}

// One write model for ordinary, recurring, and challenge programs. During
// migration only, a record without a canonical form inherits its legacy guest
// question IDs; every subsequent settings save publishes the canonical form.
export function materializeProgramApplicationForm(applicationForm, guestProperties) {
    return applicationForm ?? { questions: legacyGuestQuestions(guestProperties) };
}

// The editor must retain blank draft labels while the persisted/visible form
// continues to ignore them until the administrator supplies a question.
export function legacyGuestDraftQuestions(guestProperties) {
    return readLegacyGuestFields(guestProperties)
        .filter(field => field?.id)
        .map(field => toLegacyGuestQuestion(field, { trimLabel: false }));
}

// A backfill must never silently drop a historical field or publish a form
// that the new server would reject. Audit first and repair only with review.
export function legacyGuestMigrationIssue(guestProperties) {
    const stored = guestProperties?.custom_fields;
    if (stored != null && !Array.isArray(stored)) return '기존 비회원 질문 형식이 배열이 아닙니다.';
    if (listVisibleLegacyGuestFields(guestProperties).length !== readLegacyGuestFields(guestProperties).length) {
        return 'ID나 내용이 비어 있는 기존 비회원 질문이 있습니다.';
    }
    return validateApplicationForm({ questions: legacyGuestQuestions(guestProperties) });
}

export function questionsForAudience(form, audience) {
    if (!Object.values(APPLICATION_AUDIENCE).includes(audience) || audience === APPLICATION_AUDIENCE.ALL) {
        throw new Error('신청자 유형이 올바르지 않습니다.');
    }
    return (form?.questions || []).filter(question =>
        question.audience === audience || question.audience === APPLICATION_AUDIENCE.ALL
    );
}

export function validateApplicationForm(form) {
    if (!Array.isArray(form?.questions) || form.questions.length > maxQuestions) {
        return `신청 질문은 ${maxQuestions}개 이내로 설정해 주세요.`;
    }
    const ids = new Set();
    for (const question of form.questions) {
        if (typeof question?.id !== 'string' || !questionIdPattern.test(question.id) || ids.has(question.id)) {
            return '질문 식별자가 없거나 중복되었습니다. 질문을 다시 추가해 주세요.';
        }
        ids.add(question.id);
        if (typeof question.label !== 'string') return '질문 내용을 1~200자로 입력해 주세요.';
        const label = question.label.trim();
        if (!label || label.length > maxLabelLength) return '질문 내용을 1~200자로 입력해 주세요.';
        if (!APPLICATION_QUESTION_TYPES[question.type]) return `${label}: 질문 유형을 확인해 주세요.`;
        if (!Object.values(APPLICATION_AUDIENCE).includes(question.audience)) return `${label}: 질문 대상을 확인해 주세요.`;
        if (typeof question.required !== 'boolean') return `${label}: 필수 여부를 확인해 주세요.`;
        if (question.type === 'select') {
            if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 30) {
                return `${label}: 선택지는 2~30개로 설정해 주세요.`;
            }
            const options = question.options.map(option => typeof option === 'string' ? option.trim() : '');
            if (options.some(option => !option || option.length > maxLabelLength) || new Set(options).size !== options.length) {
                return `${label}: 빈 항목이나 중복 없이 선택지를 설정해 주세요.`;
            }
        } else if (question.options !== undefined && (!Array.isArray(question.options) || question.options.length > 0)) {
            return `${label}: 이 질문 유형에는 선택지를 넣을 수 없습니다.`;
        }
    }
    return null;
}

export function validateApplicationAnswers(form, audience, answers) {
    const definitionError = validateApplicationForm(form);
    if (definitionError) return definitionError;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return '신청 답변 형식이 올바르지 않습니다.';
    const serialized = JSON.stringify(answers);
    if (!serialized || new TextEncoder().encode(serialized).length > maxAnswerBytes) return '신청 답변의 크기가 너무 큽니다.';

    const questions = questionsForAudience(form, audience);
    const allowed = new Set(questions.map(question => question.id));
    if (Object.keys(answers).some(id => !allowed.has(id))) return '이 신청자에게 해당하지 않는 답변이 포함되어 있습니다.';

    for (const question of questions) {
        const answer = answers[question.id];
        if (answer == null || answer === '') {
            if (question.required) return `${question.label}: 답변을 입력해 주세요.`;
            continue;
        }
        if (typeof answer !== 'string' || !answer.trim()) return `${question.label}: 답변을 확인해 주세요.`;
        if (question.type === 'select') {
            if (!question.options.includes(answer)) return `${question.label}: 선택지를 확인해 주세요.`;
        } else if (answer.length > maxTextLength) {
            return `${question.label}: ${maxTextLength.toLocaleString()}자 이내로 작성해 주세요.`;
        }
    }
    return null;
}
