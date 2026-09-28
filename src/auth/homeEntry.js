export function getHomeEntry(auth, hasSpecialReturn, isStaff) {
    if (hasSpecialReturn) return 'landing';
    if (auth.status === 'authenticated' && auth.profile?.id) {
        return isStaff(auth.profile) ? 'admin' : 'student';
    }
    if (['initializing', 'restoring', 'refreshing'].includes(auth.status)) return 'waiting';
    // A failed session recheck must not lock everyone out of the public login
    // screen. Protected routes still require a verified authenticated state.
    if (auth.status === 'offline') return 'landing';
    return 'landing';
}
