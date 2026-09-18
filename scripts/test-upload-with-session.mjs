import assert from 'node:assert/strict';
import { uploadWithSession } from '../src/auth/uploadWithSession.js';

const file = { name: 'board.png' };
const profileId = crypto.randomUUID();
const auth = {
    getSession: async () => { throw new Error('upload must use the already verified screen token'); },
    refreshSession: async () => { throw new Error('upload must never force a refresh or sign out'); },
};
const options = { auth, profileId, kind: 'notice', file, sessionToken: 'verified-token' };
let uploads = 0;
assert.equal(await uploadWithSession({
    ...options,
    upload: async (_input, { accessToken }) => { uploads += 1; assert.equal(accessToken, 'verified-token'); return 'https://example.test/board.png'; },
    verifySession: async () => { throw new Error('successful upload does not need another check'); },
}), 'https://example.test/board.png');
assert.equal(uploads, 1);

await assert.rejects(
    uploadWithSession({ ...options, upload: async () => { throw { code: 'invalid_login' }; },
        verifySession: async token => { assert.equal(token, 'verified-token'); return { decision: 'retain' }; } }),
    error => /로그인은 유지 중/.test(error.message) && error.code !== 'reauth_required'
);
await assert.rejects(
    uploadWithSession({ ...options, upload: async () => { throw { code: 'invalid_login' }; },
        verifySession: async () => ({ decision: 'reauth' }) }),
    error => error.code === 'reauth_required'
);
await assert.rejects(
    uploadWithSession({ ...options, sessionToken: null,
        upload: async () => { throw new Error('no upload without a token'); } }),
    error => error.code === 'reauth_required'
);
await assert.rejects(
    uploadWithSession({ ...options, upload: async () => { throw { code: 'forbidden' }; },
        verifySession: async () => { throw new Error('permission denial is final'); } }),
    error => error.code === 'forbidden'
);
console.log('Board upload uses the verified token without refreshing or signing out and distinguishes server rejection from an expired login.');
