export const isAdminOrStaff = (user) => {
    if (!user) return false;
    return user.name === 'admin' ||
        user.user_group === '관리자' ||
        user.user_group === 'STAFF' ||
        user.role === 'admin' ||
        user.role === 'STAFF';
};
