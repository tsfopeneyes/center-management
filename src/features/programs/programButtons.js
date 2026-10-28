const value = (program, key, fallback) => program?.guest_properties?.[key] ?? program?.[key] ?? fallback;
const text = item => String(item ?? '').trim();
export const normalizeProgramQuestion = item => typeof item === 'string'
    ? { question: item, description: '' }
    : { question: String(item?.question ?? ''), description: String(item?.description ?? '') };
export const getProgramQuestions = items => Array.isArray(items) ? items.map(normalizeProgramQuestion) : [];
export const PROGRAM_BUTTON_TEMPLATES = [
    { value: 'GUIDE', label: '안내문', description: '기도문, 준비물 등 안내 내용과 링크를 보여줍니다.' },
    { value: 'TEAM', label: '팀 배치 안내', description: '참가자가 자신에게 배정된 팀을 확인합니다.' },
    { value: 'QUESTIONS', label: '나눔 질문', description: '설정한 방식에 따라 전체 질문 또는 무작위 질문 한 개를 보여줍니다.' },
    { value: 'TEAM_QUESTIONS', label: '팀 배치와 나눔 질문', description: '팀 안내와 질문이 함께 필요한 버튼에 사용합니다.' },
];
export const buttonHasTeams = button => ['TEAM', 'TEAM_QUESTIONS'].includes(button.template);
export const buttonHasQuestions = button => ['QUESTIONS', 'TEAM_QUESTIONS'].includes(button.template);
export const getProgramButtonLabel = button => text(button.name)
    || ({ GUIDE: '프로그램 안내', TEAM: '팀 확인하기', QUESTIONS: '질문 보기', TEAM_QUESTIONS: '팀 확인 및 질문 보기' })[button.template];
export const normalizeProgramButton = (button = {}, index = 0) => ({
    id: text(button.id) || `button-${index + 1}`,
    enabled: button.enabled !== false,
    template: PROGRAM_BUTTON_TEMPLATES.some(item => item.value === button.template) ? button.template : 'GUIDE',
    name: String(button.name ?? ''),
    content: String(button.content ?? ''),
    link: String(button.link ?? ''),
    trigger: button.trigger === 'end_time' ? 'end_time' : 'start_time',
    offset_minutes: Math.max(0, Number(button.offset_minutes) || 0),
    group_count: Math.min(50, Math.max(1, Math.floor(Number(button.group_count) || 4))),
    question_display_mode: button.question_display_mode === 'RANDOM' ? 'RANDOM' : 'LIST',
    questions: getProgramQuestions(button.questions),
});

export const getProgramButtons = program => {
    const stored = program?.program_buttons ?? program?.guest_properties?.program_buttons;
    // An explicitly empty list must not resurrect a removed legacy button.
    if (Array.isArray(stored)) return stored.map(normalizeProgramButton);
    const teams = value(program, 'enable_group_assignment', false) === true;
    const questions = value(program, 'enable_random_questions', false) === true;
    const rawQuestions = value(program, 'random_questions', []);
    const hasQuestions = questions && getProgramQuestions(rawQuestions).some(item => text(item.question));
    const name = value(program, 'post_program_button_name', '');
    const content = value(program, 'post_program_button_content', '');
    const link = value(program, 'post_program_button_link', '');
    if (!teams && !hasQuestions && ![name, content, link].some(text)) return [];
    return [normalizeProgramButton({
        id: 'legacy-button', enabled: value(program, 'enable_post_program_button', true) === true,
        template: teams ? (hasQuestions ? 'TEAM_QUESTIONS' : 'TEAM') : (hasQuestions ? 'QUESTIONS' : 'GUIDE'),
        name, content, link,
        trigger: value(program, 'post_program_button_trigger', 'start_time'),
        offset_minutes: value(program, 'post_program_button_offset_minutes', 0),
        group_count: value(program, 'group_count', 4), questions: rawQuestions,
    })];
};

export const isProgramButtonConfigured = button => buttonHasTeams(button)
    || (buttonHasQuestions(button) && getProgramQuestions(button.questions).some(item => text(item.question)))
    || (button.template === 'GUIDE' && [button.name, button.content, button.link].some(text));

export const validateProgramButtons = buttons => {
    for (const [index, button] of buttons.entries()) {
        if (!button.enabled) continue;
        const prefix = `버튼 ${index + 1}: `;
        const questions = getProgramQuestions(button.questions);
        if (buttonHasQuestions(button) && !questions.some(item => text(item.question))) return prefix + '나눔 질문을 하나 이상 입력해주세요.';
        if (!isProgramButtonConfigured(button)) return prefix + '안내 내용이나 링크를 입력해주세요.';
        if (buttonHasQuestions(button) && questions.some(item => !text(item.question))) return prefix + '빈 나눔 질문을 입력하거나 삭제해주세요.';
        if (button.template === 'GUIDE' && text(button.link)) {
            try { if (!['http:', 'https:'].includes(new URL(text(button.link)).protocol)) throw new Error(); }
            catch { return prefix + '링크는 http 또는 https 주소로 입력해주세요.'; }
        }
    }
    return '';
};

export const isProgramButtonVisible = (button, program, now = Date.now()) => {
    if (!button.enabled || !isProgramButtonConfigured(button) || program.program_status === 'CANCELLED') return false;
    const manuallyEnded = value(program, 'is_ended', false) === true || program.program_status === 'COMPLETED';
    if (manuallyEnded) return true;
    const date = program.today_session?.starts_at || program.program_date || program.program_start_date;
    if (!date) return false;
    const start = Date.parse(date);
    if (!Number.isFinite(start)) return false;
    const duration = String(program.program_duration || '');
    const hours = duration.match(/([\d.]+)\s*(시간|h)/i);
    const minutes = duration.match(/([\d.]+)\s*(분|m)/i);
    const plain = parseFloat(duration);
    const durationMinutes = hours || minutes
        ? Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0)
        : Number.isFinite(plain) && plain > 0 ? (plain <= 12 ? plain * 60 : plain) : 60;
    const end = program.today_session?.ends_at ? Date.parse(program.today_session.ends_at) : start + durationMinutes * 60000;
    const activation = button.trigger === 'end_time' ? end : start - button.offset_minutes * 60000;
    return Number(now) >= activation;
};
