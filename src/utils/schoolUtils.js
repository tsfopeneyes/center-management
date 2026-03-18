export const normalizeSchoolName = (name) => {
    if (!name) return '';
    // Remove all whitespace to handle spaces like "한국 고등학교"
    let normalized = name.replace(/\s+/g, '');

    // Common endings
    normalized = normalized.replace(/여자고등학교$/, '여고');
    normalized = normalized.replace(/여자중학교$/, '여중');
    normalized = normalized.replace(/과학고등학교$/, '과고');
    normalized = normalized.replace(/외국어고등학교$/, '외고');
    normalized = normalized.replace(/고등학교$/, '고');
    normalized = normalized.replace(/중학교$/, '중');
    normalized = normalized.replace(/초등학교$/, '초');

    return normalized;
};
