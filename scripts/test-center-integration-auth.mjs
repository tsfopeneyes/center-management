import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createMcpAuthorizer, createMcpTokenVerifier, extractBearerToken } from '../supabase/functions/_shared/centerIntegration/oauth.mjs';

const issuer = 'https://synthetic.supabase.co/auth/v1';
const resource = 'https://synthetic.supabase.co/functions/v1/center-api';
const ids = Object.freeze({
    auth: '11111111-1111-4111-8111-111111111111',
    session: '22222222-2222-4222-8222-222222222222',
    client: '33333333-3333-4333-8333-333333333333',
    connection: '44444444-4444-4444-8444-444444444444',
    profile: '55555555-5555-4555-8555-555555555555',
});
const fixedNow = Date.parse('2026-02-01T00:00:00.000Z');
const keyPair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
const jwk = { ...await webcrypto.subtle.exportKey('jwk', keyPair.publicKey), kid: 'synthetic', alg: 'ES256', use: 'sig' };
const b64 = value => Buffer.from(value).toString('base64url');
const baseClaims = Object.freeze({
    iss: issuer, aud: resource, role: 'center_integration_token', sub: ids.auth, session_id: ids.session,
    client_id: ids.client, center_connection_id: ids.connection, center_grant_version: 3, center_credential_version: 7,
    center_permissions: ['analytics.read', 'programs.read'], iat: fixedNow / 1000, exp: fixedNow / 1000 + 600,
});
const sign = async (patch = {}, header = { alg: 'ES256', kid: 'synthetic' }) => {
    const encodedHeader = b64(JSON.stringify(header));
    const encodedPayload = b64(JSON.stringify({ ...baseClaims, ...patch }));
    const signature = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`));
    return `${encodedHeader}.${encodedPayload}.${Buffer.from(signature).toString('base64url')}`;
};
const verifier = createMcpTokenVerifier({ issuer, resource, loadJwks: async () => ({ keys: [jwk] }), cryptoApi: webcrypto, now: () => fixedNow });
let live = true;
const authorizer = createMcpAuthorizer({ verifyToken: verifier, connectionStore: {
    loadActiveTokenState: async values => live ? {
        connection_id: values.connectionId,
        auth_user_id: values.authUserId,
        profile_id: ids.profile,
        client_id: values.clientId,
        grant_version: values.grantVersion,
        credential_version: values.credentialVersion,
        capabilities: ['analytics.read', 'programs.read'],
    } : null,
} });
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`CENTER AUTH PASS ${name}`); };

await check('valid resource-bound token requires matching live connection', async () => {
    const token = await sign();
    const actor = await authorizer(`Bearer ${token}`);
    assert.equal(actor.profile_id, ids.profile);
    assert.deepEqual(actor.capabilities, ['analytics.read', 'programs.read']);
});

await check('issuer, audience, role, version, claims, expiration and untrusted headers are rejected', async () => {
    for (const patch of [
        { iss: 'https://other.invalid/auth/v1' }, { aud: 'https://other.invalid' }, { role: 'authenticated' },
        { center_grant_version: 0 }, { center_permissions: ['analytics.read', 'members.write'] }, { exp: fixedNow / 1000 },
    ]) assert.equal(await verifier(await sign(patch)), null);
    assert.equal(await verifier(await sign({}, { alg: 'none', kid: 'synthetic' })), null);
    assert.equal(await verifier(await sign({}, { alg: 'ES256', kid: 'synthetic', jku: 'https://evil.invalid' })), null);
});

await check('local revoke or changed live state blocks a cryptographically valid token', async () => {
    live = false;
    assert.equal(await authorizer(`Bearer ${await sign()}`), null);
    live = true;
});

await check('bearer parser does not accept arbitrary authorization text', async () => {
    assert.equal(extractBearerToken('Basic abc'), null);
    assert.equal(extractBearerToken('Bearer has spaces'), null);
    assert.equal(extractBearerToken('Bearer abc.def_ghi'), 'abc.def_ghi');
});

await check('a JWKS outage remains unavailable instead of looking like an invalid user token', async () => {
    const unavailable = createMcpTokenVerifier({
        issuer,
        resource,
        loadJwks: async () => { throw new Error('network unavailable'); },
        cryptoApi: webcrypto,
        now: () => fixedNow,
    });
    await assert.rejects(async () => unavailable(await sign()), error => error instanceof Error && error.code === 'temporarily_unavailable');
});

console.log(`${passed} integration authorization checks passed`);
