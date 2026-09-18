import assert from 'node:assert/strict';
import { uploadWithSession } from '../src/auth/uploadWithSession.js';

const file = { name: 'board.png' };
const profileId = crypto.randomUUID();
const tokens = [];
let refreshed = 0;
const auth = {
    getSession: async () => ({ data: { session: { access_token: 'old' } } }),
    refreshSession: async () => { refreshed += 1; return { data: { session: { access_token: 'fresh' } } }; },
};
const upload = async (_input, { accessToken }) => {
    tokens.push(accessToken);
    if (accessToken === 'old') throw { code: 'invalid_login' };
    return 'https://example.test/board.png';
};
assert.equal(await uploadWithSession({ auth, upload, profileId, kind: 'notice', file }), 'https://example.test/board.png');
assert.deepEqual(tokens, ['old', 'fresh']);
assert.equal(refreshed, 1);

await assert.rejects(
    uploadWithSession({ auth, upload: async () => { throw { code: 'invalid_login' }; }, profileId, kind: 'notice', file }),
    error => error.code === 'reauth_required' && /로그인/.test(error.message)
);
await assert.rejects(
    uploadWithSession({ auth: { getSession: async () => ({ data: { session: null } }) }, upload, profileId, kind: 'notice', file }),
    error => error.code === 'reauth_required'
);
await assert.rejects(
    uploadWithSession({ auth, upload: async () => { throw { code: 'forbidden' }; }, profileId, kind: 'notice', file }),
    error => error.code === 'forbidden'
);
assert.equal(refreshed, 2, 'permission failures do not retry or change the session');
console.log('Image upload refreshes one rejected token, then requests login only when needed.');
