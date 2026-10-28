import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createOAuthAuthenticator, assessOAuthConsent, READ_SCOPES } from '../supabase/functions/_shared/centerMcp/oauth.mjs';
import { createMcpHandler, TOOLS } from '../supabase/functions/_shared/centerMcp/handler.mjs';
import { createCenterMcpRuntime } from '../supabase/functions/_shared/centerMcp/runtime.mjs';
import { createPostgresSourceReader, createAccountStateReader } from '../supabase/functions/_shared/centerMcp/postgres.mjs';
import { sourcePlans, SOURCE_NAMES } from '../supabase/functions/_shared/operationStatistics/source.mjs';
import { periodWindow } from '../supabase/functions/_shared/operationStatistics/policy.mjs';

// Ephemeral synthetic signature fixtures only; no installed key, auth server,
// remote request, account, client registration or persistent token is created.
const savedFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('network prohibited'); };
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`MCP PASS ${name}`); };
const resource = 'https://synthetic.invalid/functions/v1/center-statistics-mcp', issuer = 'https://synthetic.invalid/auth/v1';
const authId = '11111111-1111-4111-8111-111111111111', profileId = '22222222-2222-4222-8222-222222222222', sessionId = '33333333-3333-4333-8333-333333333333';
const now = Date.parse('2026-02-01T00:00:00+09:00');
const keypair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
const jwk = { ...await webcrypto.subtle.exportKey('jwk', keypair.publicKey), kid: 'synthetic-key', alg: 'ES256', use: 'sig' };
const b64 = value => Buffer.from(value).toString('base64url');
const claims = { iss: issuer, aud: resource, client_id: 'synthetic-client', sub: authId, session_id: sessionId, role: 'center_mcp_oauth', exp: now / 1000 + 600, iat: now / 1000, center_permissions: [...READ_SCOPES] };
const sign = async (values = claims, header = { alg: 'ES256', kid: jwk.kid }) => {
    const message = b64(JSON.stringify(header)) + '.' + b64(JSON.stringify(values));
    return message + '.' + b64(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keypair.privateKey, new TextEncoder().encode(message)));
};
const account = { authUserId: authId, profileId, mappingVerified: true, status: 'active', mustChangePassword: false, credentialVersion: 3, role: 'master', roleEnabled: true };
const grant = { active: true, authUserId: authId, profileId, sessionId, clientId: 'synthetic-client', credentialVersion: 3 };
const authOptions = { issuer, resource, clientId: 'synthetic-client', allowedAuthUserId: authId, allowedProfileId: profileId, loadJwks: async () => ({ keys: [jwk] }), loadAccountState: async () => account, loadLiveGrant: async () => grant, cryptoApi: webcrypto, now: () => now };
const authenticate = createOAuthAuthenticator(authOptions), token = await sign();
const empty = { complete: true, datasets: Object.fromEntries(SOURCE_NAMES.map(name => [name, []])) };
const policy = { id: 'synthetic-reviewed', reviewed: true, metadataReviewed: true, metrics: ['visits'], periodKinds: ['month'], rules: { visits: { allowExact: true, minimumSubjects: 0 } }, catalog: { internal_program_ref: { alias: 'public-workshop', approved: true, published: true, title: 'Synthetic workshop', description: 'Approved group activity', user_id: 'never-output', arbitrary: 'never-output' }, rejected: { alias: 'unsafe', approved: false, published: true, description: 'private text' } } };
let reads = 0;
const options = { resource, issuer, authenticate, authorizedSubject: profileId, readSources: async () => { reads++; return empty; }, publicationPolicy: policy, authorizeRelease: async () => ({ allowed: true }), now: () => new Date(now) };
const handler = createMcpHandler(options);
const request = (method, params, override = {}) => new Request(override.url || resource, { method: 'POST', headers: { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'MCP-Protocol-Version': '2025-06-18', ...override.headers }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
try {
    await check('signature verification plus exact resource/client/account grant', async () => {
        assert.deepEqual(await authenticate(token), { verified: true, active: true, subject: profileId, scopes: READ_SCOPES });
        assert.equal(await authenticate(token.slice(0, -3) + 'AAA'), null);
    });
    await check('ordinary Supabase JWT is not an MCP permission', async () => {
        assert.equal(await authenticate(await sign({ ...claims, aud: 'authenticated' })), null);
        assert.equal(await authenticate(await sign({ ...claims, center_permissions: undefined, scope: 'openid email profile' })), null);
        assert.equal(await authenticate(await sign({ ...claims, client_id: 'other-client' })), null);
    });
    await check('issuer / expiry / future nbf / forged user / extra permission', async () => {
        for (const patch of [{ iss: 'https://other.invalid' }, { exp: now / 1000 }, { nbf: now / 1000 + 1 }, { sub: profileId }, { center_permissions: [...READ_SCOPES, 'members:write'] }]) assert.equal(await authenticate(await sign({ ...claims, ...patch })), null);
        assert.equal(await authenticate(await sign(claims, { alg: 'none', kid: jwk.kid })), null);
        assert.equal(await authenticate(await sign(claims, { alg: 'ES256', kid: jwk.kid, jku: 'https://evil.invalid' })), null);
    });
    await check('protected mapping / role / password / live revocation checked', async () => {
        for (const patch of [{ mappingVerified: false }, { status: 'blocked' }, { roleEnabled: false }, { mustChangePassword: true }, { profileId: sessionId }]) assert.equal(await createOAuthAuthenticator({ ...authOptions, loadAccountState: async () => ({ ...account, ...patch }) })(token), null);
        for (const patch of [{ active: false }, { credentialVersion: 2 }, { sessionId: authId }]) assert.equal(await createOAuthAuthenticator({ ...authOptions, loadLiveGrant: async () => ({ ...grant, ...patch }) })(token), null);
    });
    await check('missing real OAuth dependencies stays disabled', async () => {
        assert.equal((await createCenterMcpRuntime()(new Request(resource))).status, 503);
        await assert.rejects(createOAuthAuthenticator({ ...authOptions, loadLiveGrant: undefined })(token), /not_configured/);
    });
    await check('metadata + 401 discovery challenge; no DB calls', async () => {
        assert.equal((await handler(new Request(resource))).status, 401);
        const challenge = await handler(new Request(resource)); assert.ok(challenge.headers.get('WWW-Authenticate').includes(resource + '/.well-known/oauth-protected-resource'));
        const meta = await (await handler(new Request(resource + '/.well-known/oauth-protected-resource'))).json();
        assert.equal(meta.resource, resource); assert.deepEqual(meta.scopes_supported, ['openid']); assert.equal(reads, 0);
    });
    await check('initialize / read-only tool discovery / Edge gateway mount', async () => {
        const initialized = await (await handler(request('initialize', { protocolVersion: '2025-06-18' }))).json(); assert.equal(initialized.result.protocolVersion, '2025-06-18');
        const list = await (await handler(request('tools/list', {}, { url: 'https://synthetic.invalid/center-statistics-mcp' }))).json();
        assert.equal(list.result.tools.length, 2); assert.ok(TOOLS.every(tool => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint));
    });
    await check('statistics call produces real zero; write/free SQL are rejected', async () => {
        const output = await (await handler(request('tools/call', { name: 'get_center_statistics', arguments: { period: { kind: 'month', date: '2026-01-01' }, metrics: ['visits'] } }))).json();
        assert.equal(output.result.structuredContent.periods[0].metrics.visits.values.unique_visitors, 0);
        assert.equal((await (await handler(request('tools/call', { name: 'delete_members', arguments: {} }))).json()).error.code, -32602);
        const invalid = await (await handler(request('tools/call', { name: 'get_center_statistics', arguments: { period: { kind: 'month', date: '2026-01-01' }, sql: 'select * from users' } }))).json();
        assert.equal(invalid.result.structuredContent.code, 'invalid_request');
    });
    await check('reviewed program catalog only; raw row/ID/text discarded', async () => {
        const output = await (await handler(request('tools/call', { name: 'get_program_catalog', arguments: {} }))).json();
        assert.equal(output.result.structuredContent.programs.length, 1);
        const serialized = JSON.stringify(output); assert.ok(!serialized.includes('internal_program_ref')); assert.ok(!serialized.includes('user_id')); assert.ok(!serialized.includes('private text'));
        const pending = createMcpHandler({ ...options, publicationPolicy: { ...policy, metadataReviewed: false } });
        assert.equal((await (await pending(request('tools/call', { name: 'get_program_catalog', arguments: {} }))).json()).result.structuredContent.code, 'policy_review_required');
    });
    await check('Origin / media type / Accept / protocol validation', async () => {
        assert.equal((await handler(request('ping', {}, { headers: { Origin: 'https://evil.invalid' } }))).status, 403);
        assert.equal((await handler(request('ping', {}, { headers: { Accept: 'application/json' } }))).status, 406);
        assert.equal((await handler(request('ping', {}, { headers: { 'Content-Type': 'application/json-bogus' } }))).status, 415);
        assert.equal((await handler(request('ping', {}, { headers: { 'MCP-Protocol-Version': 'unknown' } }))).status, 400);
    });
    await check('body limit and initialized notification', async () => {
        assert.equal((await handler(request('ping', { padding: 'x'.repeat(20000) }))).status, 413);
        const notification = new Request(resource, { method: 'POST', headers: request('ping', {}).headers, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
        assert.equal((await handler(notification)).status, 202);
    });
    await check('consent uses vetted existing auth + exact Jin/client, no account creation', async () => {
        const config = { authorizeExistingSession: async () => ({ actorProfileId: profileId, authUserId: authId }), expectedClientId: 'synthetic-client', expectedProfileId: profileId, expectedAuthUserId: authId, client: { id: 'synthetic-client', reviewed: true } };
        assert.deepEqual(await assessOAuthConsent(config), { allowed: true });
        assert.deepEqual(await assessOAuthConsent({ ...config, client: { id: 'other', reviewed: true } }), { allowed: false });
    });
    await check('Postgres 1501 rows: repeatable read + keyset + whitelist + rollback', async () => {
        const window = { ...periodWindow({ kind: 'month', date: '2026-01-01' }), asOf: new Date(now).toISOString() };
        const statements = [], people = Array.from({ length: 1501 }, (_, id) => ({ id, user_group: '청소년' })); let released = false;
        const pool = { connect: async () => ({ query: async (sql, values = []) => {
            statements.push({ sql, values });
            if (sql === 'SELECT current_user AS role') return { rows: [{ role: 'center_statistics_reader' }] };
            if (sql.includes('FROM public."users"')) { const cursor = sql.includes('ROW(') ? values.at(-2) : -1; return { rows: people.filter(row => row.id > cursor).slice(0, values.at(-1)) }; }
            return { rows: [] };
        }, release: () => { released = true; } }) };
        const output = await createPostgresSourceReader({ pool })(window); assert.equal(output.datasets.users.length, 1501);
        assert.equal(statements[0].sql, 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'); assert.equal(statements.at(-1).sql, 'ROLLBACK'); assert.equal(released, true);
        assert.ok(statements.some(row => row.sql.includes('ROW("id") > ROW($1)')));
        assert.ok(statements.filter(row => row.sql.includes('FROM public.')).every(row => !row.sql.includes('SELECT *') && !row.sql.includes('name')));
        assert.equal(sourcePlans(window).length, 9);
    });
    await check('Postgres source error / broad role / missing asOf never become zero', async () => {
        const window = { ...periodWindow({ kind: 'day', date: '2026-01-01' }), asOf: new Date(now).toISOString() }; let rolledBack = false;
        const pool = { connect: async () => ({ query: async sql => { if (sql === 'ROLLBACK') rolledBack = true; return { rows: [{ role: 'postgres' }] }; }, release() {} }) };
        await assert.rejects(createPostgresSourceReader({ pool })(window), /source_incomplete/); assert.equal(rolledBack, true);
        assert.throws(() => createPostgresSourceReader({ pool })({ ...window, asOf: undefined }), /source_incomplete/);
    });
    await check('account mapping is parameterized protected SELECT, no public fallback', async () => {
        const queries = [];
        const pool = { connect: async () => ({ query: async (sql, values) => { queries.push({ sql, values }); return { rows: sql.includes('current_user') ? [{ role: 'center_statistics_reader' }] : sql.includes('account_security.accounts') ? [account] : [] }; }, release() {} }) };
        assert.deepEqual(await createAccountStateReader({ pool })(authId), account);
        assert.deepEqual(queries.find(q => q.sql.includes('account_security.accounts')).values, [authId]);
        assert.ok(!queries.some(q => /UPDATE|DELETE|INSERT|GRANT|CREATE/.test(q.sql)));
    });
    console.log(`${passed} MCP preparation checks passed (synthetic only; OAuth flow NOT activated/verified)`);
} finally { globalThis.fetch = savedFetch; }
