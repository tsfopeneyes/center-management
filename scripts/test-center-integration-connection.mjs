import assert from 'node:assert/strict';
import { createConnectionService } from '../supabase/functions/_shared/centerIntegration/connectionService.mjs';
import { createConnectionStore } from '../supabase/functions/_shared/centerIntegration/connectionStore.mjs';

const ids = Object.freeze({
    auth: '11111111-1111-4111-8111-111111111111',
    profile: '22222222-2222-4222-8222-222222222222',
    client: '33333333-3333-4333-8333-333333333333',
    request: '44444444-4444-4444-8444-444444444444',
    connection: '55555555-5555-4555-8555-555555555555',
});
const actor = Object.freeze({ active: true, auth_user_id: ids.auth, profile_id: ids.profile, credential_version: 7, role: 'master' });
const resource = 'https://example.supabase.co/functions/v1/center-api/mcp';
const authorization = Object.freeze({
    authorization_id: 'synthetic_authorization', client_id: ids.client, user_id: ids.auth,
    resource, status: 'pending', redirect_uri: 'https://chatgpt.com/connector/oauth/callback',
    code_challenge_method: 'S256', expires_at: '2026-02-01T01:00:00.000Z',
});
let stored = null;
let nativeState = 'active';
let pendingRedirectUri = authorization.redirect_uri;
const store = {
    listOwn: async () => [],
    createConsentRequest: async input => { stored = input; return { request_id: ids.request, connection_id: ids.connection, client_label: '합성 ChatGPT', capabilities: input.capabilities, expires_at: input.expiresAt }; },
    loadPendingConsentRequest: async () => ({ authorization_id: authorization.authorization_id, client_id: ids.client, redirect_uri: pendingRedirectUri }),
    activateConsentRequest: async () => ({ connection_id: ids.connection, state: 'active' }),
    beginRevoke: async () => ({ id: ids.connection, client_id: ids.client, state: 'revoke_pending' }),
    finishRevoke: async () => ({ id: ids.connection, state: 'revoked' }),
    loadRevokePending: async () => ({ id: ids.connection, client_id: ids.client, state: 'revoke_pending' }),
};
const nativeOAuth = {
    readAuthorization: async () => ({ ...authorization, status: nativeState === 'approved' ? 'approved' : authorization.status }),
    revokeGrant: async () => { if (nativeState === 'failure') throw new Error('native unavailable'); nativeState = 'revoked'; },
    isGrantRevoked: async () => nativeState === 'revoked',
};
const service = createConnectionService({ store, nativeOAuth, config: { resource }, now: () => new Date('2026-02-01T00:00:00.000Z'), requestId: () => ids.request });
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`CENTER CONNECTION PASS ${name}`); };

await check('prepare binds exact native authorization, account, client, resource and PKCE', async () => {
    const output = await service.prepare(actor, { authorization_id: authorization.authorization_id });
    assert.equal(output.request_id, ids.request);
    assert.equal(stored.authUserId, ids.auth);
    assert.equal(stored.profileId, ids.profile);
    assert.equal(stored.clientId, ids.client);
    assert.equal(stored.resource, resource);
    assert.deepEqual(stored.capabilities, ['analytics.read', 'programs.read']);
});

await check('complete requires native approval and never trusts browser body client data', async () => {
    await assert.rejects(() => service.complete(actor, { request_id: ids.request }), error => error.code === 'forbidden');
    nativeState = 'approved';
    pendingRedirectUri = 'https://attacker.invalid/callback';
    await assert.rejects(() => service.complete(actor, { request_id: ids.request }), error => error.code === 'forbidden');
    pendingRedirectUri = authorization.redirect_uri;
    const output = await service.complete(actor, { request_id: ids.request });
    assert.deepEqual(output, { connection_id: ids.connection, state: 'active' });
});

await check('local revoke remains deny-first if native revoke fails', async () => {
    nativeState = 'failure';
    const output = await service.revoke(actor, { connection_id: ids.connection });
    assert.deepEqual(output, { connection_id: ids.connection, state: 'revoke_pending' });
});

await check('reconcile only changes local state after native grant is confirmed revoked', async () => {
    nativeState = 'active';
    assert.deepEqual(await service.reconcileRevocation(actor, { connection_id: ids.connection }), { connection_id: ids.connection, state: 'revoke_pending' });
    nativeState = 'revoked';
    assert.deepEqual(await service.reconcileRevocation(actor, { connection_id: ids.connection }), { connection_id: ids.connection, state: 'revoked' });
});

await check('store SQL only mutates private connection metadata', async () => {
    const queries = [];
    const transaction = async (operation) => operation(async (sql, values) => { queries.push({ sql, values }); return { rows: [] }; });
    const sqlStore = createConnectionStore({ withControlTransaction: transaction });
    assert.equal(await sqlStore.loadActiveTokenState({ connectionId: ids.connection, authUserId: ids.auth, clientId: ids.client, sessionId: ids.request, grantVersion: 1, credentialVersion: 1 }), null);
    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /^\s*SELECT/i);
    assert.match(queries[0].sql, /center_integration\.settings/);
    assert.match(queries[0].sql, /integration_active/);
    assert.doesNotMatch(queries[0].sql, /authorization_code|refresh_token|client_secret|\b(?:UPDATE|DELETE|INSERT)\b/i);
});

await check('consent preparation is gated by the enabled pilot allowlist in the database query', async () => {
    const queries = [];
    const store = createConnectionStore({ withControlTransaction: async operation => operation(async (sql, values) => {
        queries.push({ sql, values });
        if (/FROM center_integration\.clients client/.test(sql)) return { rows: [{ id: ids.client, client_label: '합성 ChatGPT', enabled: true, retired_at: null }] };
        if (/FROM center_integration\.consent_requests r/.test(sql)) return { rows: [] };
        if (/INSERT INTO center_integration\.connections/.test(sql)) return { rows: [{ id: ids.connection, state: 'pending', capabilities: ['analytics.read', 'programs.read'], grant_version: 1 }] };
        if (/INSERT INTO center_integration\.consent_requests/.test(sql)) return { rows: [{ id: ids.request, connection_id: ids.connection, expires_at: '2026-02-01T01:00:00.000Z' }] };
        throw new Error(`unexpected query: ${sql}`);
    }) });
    await store.createConsentRequest({
        id: ids.request,
        authorizationId: authorization.authorization_id,
        authUserId: ids.auth,
        profileId: ids.profile,
        clientId: ids.client,
        redirectUri: authorization.redirect_uri,
        resource,
        capabilities: ['analytics.read', 'programs.read'],
        credentialVersion: 7,
        expiresAt: authorization.expires_at,
    });
    const gate = queries.find(item => /FROM center_integration\.clients client/.test(item.sql));
    assert.match(gate.sql, /JOIN center_integration\.settings setting ON setting\.singleton/);
    assert.match(gate.sql, /setting\.enabled=true/);
    assert.match(gate.sql, /\$4::uuid=ANY\(setting\.pilot_profile_ids\)/);
    assert.equal(gate.values[3], ids.profile);
});

console.log(`${passed} connection service checks passed`);
