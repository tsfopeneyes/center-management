const value = (program, key, fallback = '') => program?.guest_properties?.[key] ?? program?.[key] ?? fallback;
const nonempty = item => String(item ?? '').trim().length > 0;
const questions = program => {
    const stored = value(program, 'random_questions', []);
    return Array.isArray(stored) ? stored : [];
};

export const getParticipantButtonLabel = program => {
    const name = value(program, 'post_program_button_name');
    if (nonempty(name)) return String(name).trim();
    const hasGroup = value(program, 'enable_group_assignment', false) === true;
    const hasQuestions = value(program, 'enable_random_questions', false) === true
        && questions(program).some(nonempty);
    if (hasGroup && hasQuestions) return '팀 확인 및 나눔 질문';
    if (hasGroup) return '팀 확인하기';
    if (hasQuestions) return '아이스브레이킹 질문';
    return '프로그램 안내';
};

export const hasParticipantExtraScreen = program => {
    if (value(program, 'enable_post_program_button', true) !== true) return false;
    return value(program, 'enable_group_assignment', false) === true
        || (value(program, 'enable_random_questions', false) === true
            && questions(program).some(nonempty))
        || nonempty(value(program, 'post_program_button_name'))
        || nonempty(value(program, 'post_program_button_content'))
        || nonempty(value(program, 'post_program_button_link'));
};
