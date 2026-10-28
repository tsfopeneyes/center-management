import assert from 'node:assert/strict';
import { consentDetails } from '../src/auth/oauthConsentDetails.mjs';
import { resumeOAuthConsent, consentFailure, consentActorKey } from '../src/auth/resumeOAuthConsent.mjs';
import { createCenterApiDiscoveryHandler, createCenterApiHandler } from '../supabase/functions/_shared/centerIntegration/http.mjs';
import { createWebsiteActorAuthorizer } from '../supabase/functions/_shared/centerIntegration/websiteAuth.mjs';
import { createManagedWebsiteSessionVerifier } from '../supabase/functions/_shared/centerIntegration/websiteSessionVerifier.mjs';

const ids = Object.freeze({ auth: '11111111-1111-4111-8111-111111111111', session: '22222222-2222-4222-8222-222222222222', profile: '33333333-3333-4333-8333-333333333333' });
const issuer = 'https://example.supabase.co/auth/v1';
const token = (() => {
    const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${part({ alg: 'ES256', kid: 'test' })}.${part({ iss: issuer, aud: 'authenticated', role: 'authenticated', sub: ids.auth, session_id: ids.session, exp: 2_000_000_000 })}.signature`;
})();
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`CENTER WEB PASS ${name}`); };

await check('session revalidation preserves authorization flow identity but account loss cancels it', async () => {
    const auth = { status: 'authenticated', session: { user: { id: ids.auth } }, profile: { id: ids.profile } };
    const key = consentActorKey(auth);
    assert.ok(key);
    assert.equal(consentActorKey({ ...auth, status: 'refreshing' }), key);
    assert.equal(consentActorKey({ ...auth, status: 'initializing' }), '');
    assert.equal(consentActorKey({ ...auth, status: 'blocked' }), '');
    assert.equal(consentActorKey({ ...auth, session: null }), '');
    assert.notEqual(consentActorKey({ ...auth, profile: { id: ids.session } }), key);
    let current = auth;
    let redirected = false;
    const stages = [];
    await resumeOAuthConsent({ authorizationId: 'request-id', redirectUrl: 'https://chatgpt.com/callback',
        isLive: () => consentActorKey(current) === key, navigate: () => { redirected = true; },
        request: async path => {
            stages.push(path);
            current = { ...auth, status: 'refreshing' };
            return path.endsWith('prepare') ? { request_id: ids.session } : { state: 'active' };
        } });
    assert.equal(stages.length, 2);
    assert.equal(redirected, true, 'session revalidation after completion must preserve the callback');
});

await check('already-consented redirect waits for exact server preparation and active completion', async () => {
    const events = [];
    const options = { authorizationId: 'request-id', redirectUrl: 'https://chatgpt.com/connector/oauth/callback?code=test',
        isLive: () => true, navigate: url => events.push(['navigate', url]),
        request: async (path, input) => { events.push([path, input.body]); return path.endsWith('prepare') ? { request_id: ids.session } : { state: 'active' }; } };
    await resumeOAuthConsent(options);
    assert.equal(events.length, 3);
    assert.deepEqual(events[0][1], { authorization_id: 'request-id' });
    assert.deepEqual(events[1][1], { request_id: ids.session });
    assert.equal(events[2][0], 'navigate');
    events.length = 0;
    await assert.rejects(resumeOAuthConsent({ ...options, request: async () => { throw Error('forbidden'); } }));
    assert.equal(events.length, 0);
    await assert.rejects(resumeOAuthConsent({ ...options, redirectUrl: 'javascript:alert(1)' }));
    await resumeOAuthConsent({ ...options, isLive: () => false });
    assert.equal(events.some(row => row[0] === 'navigate'), false);
});

await check('consent diagnostics identify completion without disclosing provider URLs or tokens', async () => {
    let stage;
    await assert.rejects(resumeOAuthConsent({ authorizationId: 'request-id', redirectUrl: 'https://chatgpt.com/callback',
        isLive: () => true, navigate: () => assert.fail('failed completion must not redirect'), onStage: value => { stage = value; },
        request: async path => { if (path.endsWith('prepare')) return { request_id: ids.session }; throw Object.assign(Error('forbidden'), { code: 'forbidden', status: 403 }); }
    }), error => { assert.match(consentFailure(stage, error), /연결 활성화.*forbidden \/ 403/); return true; });
    assert.match(consentFailure('details', Error('https://example.com?token=secret')), /unknown_error/);
    assert.equal(consentFailure('details', Error('https://example.com?token=secret')).includes('secret'), false);
});

await check('consent accepts actual ChatGPT provider scopes and rejects unsupported permissions', async () => {
    const request = { authorization_id: 'request-id', client: { name: '센터 분석' }, scope: 'openid email offline_access' };
    assert.deepEqual(consentDetails(request), { clientName: '센터 분석' });
    assert.deepEqual(consentDetails({ ...request, scope: 'openid' }), { clientName: '센터 분석' });
    assert.equal(consentDetails({ ...request, scope: 'email offline_access' }), null);
    assert.equal(consentDetails({ ...request, scope: 'openid data.write' }), null);
    assert.equal(consentDetails({ ...request, client: {} }), null);
});

await check('managed website verification binds a provider-verified bearer to the exact live session', async () => {
    let liveRead = null;
    const verify = createManagedWebsiteSessionVerifier({
        issuer,
        publishableKey: 'public-key',
        now: () => 1_700_000_000_000,
        fetcher: async (url, options) => {
            assert.equal(url, `${issuer}/user`);
            assert.equal(options.headers.Authorization, `Bearer ${token}`);
            return new Response(JSON.stringify({ id: ids.auth, is_anonymous: false }), { status: 200 });
        },
        loadLiveSession: async (sessionId, authUserId) => {
            liveRead = { sessionId, authUserId };
            return { session_id: ids.session, auth_user_id: ids.auth, live: true };
        },
    });
    assert.deepEqual(await verify(token), { auth_user_id: ids.auth, session_id: ids.session });
    assert.deepEqual(liveRead, { sessionId: ids.session, authUserId: ids.auth });
    assert.equal(await verify('not-a-token'), null);
});

await check('website actor uses protected account state instead of JWT roles or browser body', async () => {
    const authorize = createWebsiteActorAuthorizer({
        verifyWebsiteSession: async received => received === token ? { auth_user_id: ids.auth, session_id: ids.session } : null,
        loadAccount: async authUserId => authUserId === ids.auth ? {
            auth_user_id: ids.auth,
            profile_id: ids.profile,
            credential_version: 3,
            mapping_verified: true,
            status: 'active',
            must_change_password: false,
            role: 'master',
            role_enabled: true,
            integration_enabled: true,
        } : null,
    });
    const actor = await authorize(`Bearer ${token}`);
    assert.equal(actor.profile_id, ids.profile);
    assert.deepEqual(actor.capabilities, ['analytics.read', 'programs.read']);
    assert.equal(await authorize('Bearer other'), null);
    const disabled = createWebsiteActorAuthorizer({
        verifyWebsiteSession: async () => ({ auth_user_id: ids.auth, session_id: ids.session }),
        loadAccount: async () => ({
            auth_user_id: ids.auth, profile_id: ids.profile, credential_version: 3,
            mapping_verified: true, status: 'active', must_change_password: false,
            role: 'master', role_enabled: true, integration_enabled: false,
        }),
    });
    assert.equal(await disabled(`Bearer ${token}`), null);
});

let analysisCall = null;
const actor = Object.freeze({ active: true, auth_user_id: ids.auth, profile_id: ids.profile, credential_version: 3, role: 'master', capabilities: ['analytics.read', 'programs.read'] });
const api = createCenterApiHandler({
    basePath: '/center-api',
    resource: 'https://example.supabase.co/functions/v1/center-api/mcp',
    protectedMetadata: { resource: 'https://example.supabase.co/functions/v1/center-api/mcp', authorization_servers: [issuer], scopes_supported: ['openid'] },
    mcpHandler: async () => new Response('mcp-ok', { status: 200 }),
    analysisService: {
        run: async invocation => {
            analysisCall = invocation;
            return { schema_version: 'center-analysis.v1', status: 'ok', as_of: '2026-02-01T00:00:00.000Z', timezone: 'Asia/Seoul', basis: 'recorded_current_state', cache: { hit: false, generated_at: '2026-02-01T00:00:00.000Z', expires_at: null }, data: {}, quality: { status: 'complete', observation_start: null, observation_end_exclusive: null, reasons: [] }, warnings: [], sources: [] };
        },
    },
    connectionService: {
        list: async () => ({ connections: [] }),
        prepare: async () => ({ request_id: 'synthetic' }),
        complete: async () => ({ state: 'active' }),
        beginRevoke: async () => ({ state: 'revoke_pending', client_id: '44444444-4444-4444-8444-444444444444' }),
        confirmRevoke: async () => ({ state: 'revoked' }),
    },
    authorizeWebsite: async header => header === 'Bearer web-token' ? actor : null,
    allowedWebOrigins: ['https://app.example.com'],
});

const webRequest = (path, method = 'GET', body = undefined, headers = {}) => new Request(`https://example.supabase.co/functions/v1/center-api${path}`, {
    method,
    headers: { Origin: 'https://app.example.com', Authorization: 'Bearer web-token', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

await check('metadata and MCP routes do not use browser CORS as authentication', async () => {
    const metadata = await api(new Request('https://example.supabase.co/functions/v1/center-api/mcp/.well-known/oauth-protected-resource'));
    assert.equal(metadata.status, 200);
    assert.equal((await metadata.json()).resource, 'https://example.supabase.co/functions/v1/center-api/mcp');
    const mcp = await api(new Request('https://example.supabase.co/functions/v1/center-api/mcp'));
    assert.equal(await mcp.text(), 'mcp-ok');
});

await check('OAuth discovery and readiness remain database-free while the feature is disabled', async () => {
    const discovery = createCenterApiDiscoveryHandler({
        basePath: '/center-api',
        protectedMetadata: { resource: 'https://example.supabase.co/functions/v1/center-api/mcp', authorization_servers: [issuer], scopes_supported: ['openid'] },
        enabled: false,
    });
    const metadata = discovery(new Request('https://example.supabase.co/functions/v1/center-api/mcp/.well-known/oauth-protected-resource'));
    assert.equal(metadata.status, 200);
    assert.equal((await metadata.json()).resource, 'https://example.supabase.co/functions/v1/center-api/mcp');
    const health = discovery(new Request('https://example.supabase.co/functions/v1/center-api/health'));
    assert.deepEqual(await health.json(), { service: 'center-api', ready: false });
    assert.equal(discovery(new Request('https://example.supabase.co/functions/v1/center-api/v1/connections')), null);
});

await check('web analysis requires an approved browser origin and actor, then uses the common service', async () => {
    const blocked = await api(webRequest('/v1/analysis/get_metric_definitions', 'POST', {}, { Origin: 'https://attacker.example' }));
    assert.equal(blocked.status, 403);
    const unauthenticated = await api(webRequest('/v1/analysis/get_metric_definitions', 'POST', {}, { Authorization: 'Bearer wrong' }));
    assert.equal(unauthenticated.status, 401);
    const response = await api(webRequest('/v1/analysis/get_metric_definitions', 'POST', {}));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://app.example.com');
    assert.equal(analysisCall.operation, 'get_metric_definitions');
    assert.equal(analysisCall.actor, actor);
});

await check('connection management has fixed own-connection routes rather than a free-form action body', async () => {
    const list = await api(webRequest('/v1/connections'));
    assert.deepEqual(await list.json(), { connections: [] });
    const bad = await api(webRequest('/v1/connections/revoke', 'POST', {}));
    assert.equal(bad.status, 404);
    const revoke = await api(webRequest('/v1/connections/44444444-4444-4444-8444-444444444444/revoke/begin', 'POST', {}));
    assert.equal((await revoke.json()).state, 'revoke_pending');
});

console.log(`${passed} web route checks passed`);
