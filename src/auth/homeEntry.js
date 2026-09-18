export function getHomeEntry(auth, hasSpecialReturn, isStaff) {
    if (hasSpecialReturn) return 'landing';
    if (auth.status === 'authenticated' && auth.profile?.id) {
        return isStaff(auth.profile) ? 'admin' : 'student';
    }
    if (['initializing', 'restoring', 'refreshing'].includes(auth.status)) return 'waiting';
    if (auth.status === 'offline' && auth.session) return 'retry';
    return 'landing';
}
