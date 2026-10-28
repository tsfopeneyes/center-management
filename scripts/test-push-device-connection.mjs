import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/firebase.js', import.meta.url), 'utf8');
const section = source.slice(source.indexOf('export const requestFirebaseToken ='), source.indexOf('export const reportPushReceipt =')).replaceAll('export const ', 'const ');
let registrations = 0;
let registry = { data: { registered: true }, error: null };
let legacy = { data: { fcm_token: null }, error: null };
const dependencies = {
    recentPushTokens: new Map(), tokenRequest: null, tokenRequestUserId: null,
    requestFirebaseTokenOnce: async () => { registrations++; return 'test-token'; },
    getPushDeviceId: () => 'test-device',
    storedPushTokenIncludes: (value, token) => value === token,
    supabase: {
        functions: { invoke: async () => registry },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => legacy }) }) }),
    },
};
const { requestFirebaseToken, isPushDeviceConnected } = new Function(...Object.keys(dependencies), `${section}\nreturn { requestFirebaseToken, isPushDeviceConnected };`)(...Object.values(dependencies));

assert.equal(await isPushDeviceConnected('user', 'test-token'), true, 'registry success must not require a legacy token');
registry = { data: { registered: false }, error: null };
assert.equal(await isPushDeviceConnected('user', 'test-token'), false);
assert.equal(await isPushDeviceConnected('user', 'WEB_PUSH:test-device'), false);
registry = { data: null, error: new Error('server unavailable') };
legacy = { data: { fcm_token: 'test-token' }, error: null };
assert.equal(await isPushDeviceConnected('user', 'test-token'), true, 'legacy fallback remains supported');
legacy = { data: null, error: null };
await assert.rejects(isPushDeviceConnected('user', 'test-token'), /server unavailable/);
await requestFirebaseToken('user');
await requestFirebaseToken('user');
assert.equal(registrations, 1, 'automatic requests use cache');
await requestFirebaseToken('user', { forceRefresh: true });
assert.equal(registrations, 2, 'manual reconnect must register again');
console.log('Push connection and reconnect regression checks passed.');
