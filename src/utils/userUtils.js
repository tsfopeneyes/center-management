export const ACCOUNT_ROLES = Object.freeze({
    MEMBER: 'member',
    ADMIN: 'admin',
    MASTER: 'master',
});

export const getAccountRole = user => {
    if (!user) return ACCOUNT_ROLES.MEMBER;
    const role = String(user.account_role ?? user.accountRole ?? '').trim().toLowerCase();
    return Object.values(ACCOUNT_ROLES).includes(role) ? role : ACCOUNT_ROLES.MEMBER;
};

export const isMasterStaff = user => getAccountRole(user) === ACCOUNT_ROLES.MASTER;

export const isAdminOrStaff = user => [ACCOUNT_ROLES.ADMIN, ACCOUNT_ROLES.MASTER].includes(getAccountRole(user));

export const isStaffUser = isAdminOrStaff;

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

export const normalizeGuestIdentityName = (name) => String(name || '')
    .replace(/\s*\(guest\)\s*$/i, '')
    .replace(/\s+/g, '')
    .trim();

export const normalizeGuestIdentitySchool = (school) => normalizeSchoolName(school)
    .replace(/\s+/g, '')
    .trim();

// Reuse an existing guest when the stable identity fields (name and school)
// agree, and prefer a program application profile because it can carry the
// student's real contact data. Birth is refreshed with explicit consent when
// the guest checks in, so legacy placeholder values do not create duplicates.
export const findMatchingGuestAccount = (users, name, school) => {
    const normalizedName = normalizeGuestIdentityName(name);
    const normalizedSchool = normalizeGuestIdentitySchool(school);
    const matches = (users || []).filter(user =>
        user?.user_group === '게스트' &&
        normalizeGuestIdentityName(user.name) === normalizedName &&
        normalizeGuestIdentitySchool(user.school) === normalizedSchool
    );

    return matches.sort((left, right) => {
        const score = user => {
            const memo = String(user?.memo || '');
            const phone = String(user?.phone || '');
            const birth = String(user?.birth || '');
            return (memo.includes('프로그램 비회원 신청') ? 4 : 0) +
                (phone && !phone.startsWith('010-0000-') && !phone.startsWith('000-0000-') ? 2 : 0) +
                (birth && birth !== '000000' ? 1 : 0);
        };
        return score(right) - score(left);
    })[0] || null;
};

