const finishWithin = async (promise, milliseconds) => {
    let timer;
    try {
        await Promise.race([
            Promise.resolve().then(() => promise()),
            new Promise(resolve => { timer = setTimeout(resolve, milliseconds); }),
        ]);
    } catch (error) {
        console.warn('Logout cleanup did not complete:', error);
    } finally {
        clearTimeout(timer);
    }
};

export async function logoutFromDevice({ userId, unregister, signOut, storage, redirect, unregisterTimeoutMs = 1500, signOutTimeoutMs = 3000 }) {
    if (userId) await finishWithin(() => unregister(userId), unregisterTimeoutMs);
    try {
        await finishWithin(signOut, signOutTimeoutMs);
    } finally {
        // A slow auth lock or network request must not keep a local session
        // usable after the person has pressed Log out.
        try {
            for (let index = storage.length - 1; index >= 0; index -= 1) {
                const key = storage.key(index);
                if (key?.startsWith('sb-') && key.endsWith('-auth-token')) storage.removeItem(key);
            }
            storage.removeItem('user');
            storage.removeItem('admin_user');
        } finally {
            redirect();
        }
    }
}
