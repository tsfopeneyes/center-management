import assert from 'node:assert/strict';
import { logoutFromDevice } from '../src/auth/logoutFromDevice.js';

const values = new Map([
    ['sb-project-auth-token', 'session'], ['user', 'member'], ['admin_user', 'staff'], ['theme', 'dark'],
]);
const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
};
let redirects = 0;
await logoutFromDevice({
    userId: 'member-id',
    unregister: () => new Promise(() => {}),
    signOut: () => new Promise(() => {}),
    storage,
    redirect: () => { redirects += 1; },
    unregisterTimeoutMs: 10,
    signOutTimeoutMs: 10,
});
assert.equal(redirects, 1);
assert.deepEqual([...values.entries()], [['theme', 'dark']]);

values.set('sb-project-auth-token', 'session');
values.set('user', 'member');
await logoutFromDevice({
    unregister: () => Promise.resolve(),
    signOut: () => Promise.reject(new Error('network unavailable')),
    storage,
    redirect: () => { redirects += 1; },
    signOutTimeoutMs: 10,
});
assert.equal(redirects, 2);
assert.deepEqual([...values.entries()], [['theme', 'dark']]);
console.log('Logout clears this device even when device unregister or auth sign-out stalls.');
