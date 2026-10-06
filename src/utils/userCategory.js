import { isAdminOrStaff } from './userUtils.js';

// Display categories only; authorization continues to use protected account roles.
export function getUserCategory(user) {
    if (!user) return '청소년';
    const group = String(user.user_group || '').trim();
    if (isAdminOrStaff(user) || group.toUpperCase() === 'STAFF') return 'STAFF';
    if (user.is_leader) return '리더';
    if (group === '게스트' || user.preferences?.is_temporary || /\(guest\)/i.test(user.name || '')) return '게스트';
    if (group === '졸업생') return '졸업생';
    return '청소년';
}
