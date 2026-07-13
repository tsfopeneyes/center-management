export const isAdminOrStaff = (user) => {
    if (!user) return false;
    return user.name === 'admin' ||
        user.user_group === '관리자' ||
        user.user_group === 'STAFF' ||
        user.role === 'admin' ||
        user.role === 'STAFF';
};

export const normalizeSchoolName = (school) => {
    if (!school) return '';
    const trimmed = school.trim();
    if (trimmed.endsWith('고등학교') || trimmed.endsWith('중학교') || trimmed.endsWith('초등학교')) {
        return trimmed;
    }
    if (trimmed.endsWith('외고')) {
        return trimmed.slice(0, -2) + '외국어고등학교';
    }
    if (trimmed.endsWith('여고')) {
        return trimmed.slice(0, -2) + '여자고등학교';
    }
    if (trimmed.endsWith('고')) {
        return trimmed.slice(0, -1) + '고등학교';
    }
    if (trimmed.endsWith('여중')) {
        return trimmed.slice(0, -2) + '여자중학교';
    }
    if (trimmed.endsWith('중')) {
        return trimmed.slice(0, -1) + '중학교';
    }
    if (trimmed.endsWith('초')) {
        return trimmed.slice(0, -1) + '초등학교';
    }
    return trimmed;
};

