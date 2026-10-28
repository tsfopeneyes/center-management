import { AnalysisError, OPERATION_NAMES } from '../centerAnalysis/contracts.mjs';

const MAX_BODY_BYTES = 16 * 1024;
const UUID = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;

function normalizedBasePath(value) {
    if (typeof value !== 'string' || !/^\/[a-z][a-z0-9-]{1,63}$/.test(value)) throw new AnalysisError('not_configured');
    return value;
}

function relativePath(pathname, basePath) {
    if (pathname === basePath) return '/';
    if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length) || '/';
    // Hosted Supabase sends either `/center-api/...` to the isolate or keeps
    // the public `/functions/v1/center-api/...` prefix.  Match the configured
    // function name as a complete path segment in both cases.
    const marker = `${basePath}/`;
    const position = pathname.lastIndexOf(marker);
    if (position < 0) return null;
    return pathname.slice(position + basePath.length) || '/';
}

function webHeaders(origin) {
    return {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization,content-type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        Vary: 'Origin',
    };
}

function json(body, status = 200, headers = {}) {
    return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}

async function jsonBody(request) {
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        throw new AnalysisError('invalid_input');
    }
    const reader = request.body?.getReader();
    if (!reader) throw new AnalysisError('invalid_input');
    const chunks = [];
    let size = 0;
    try {
        for (;;) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > MAX_BODY_BYTES) throw new AnalysisError('invalid_input');
            chunks.push(part.value);
        }
    } finally {
        try { reader.releaseLock(); } catch { /* body is already terminal */ }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let value;
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new AnalysisError('invalid_input'); }
    if (!plainObject(value)) throw new AnalysisError('invalid_input');
    return value;
}

function errorResponse(error, origin = null) {
    const code = error instanceof AnalysisError ? error.code : 'temporarily_unavailable';
    const status = code === 'unauthenticated' ? 401
        : code === 'forbidden' ? 403
            : code === 'invalid_input' ? 400
                : code === 'not_configured' ? 503 : 503;
    return json({ error: { code } }, status, origin ? webHeaders(origin) : {});
}

function requireWebOrigin(request, allowedOrigins) {
    const origin = request.headers.get('Origin');
    if (typeof origin !== 'string' || !allowedOrigins.includes(origin)) throw new AnalysisError('forbidden');
    return origin;
}

async function websiteActor(request, authorizeWebsite) {
    if (typeof authorizeWebsite !== 'function') throw new AnalysisError('not_configured');
    const actor = await authorizeWebsite(request.headers.get('Authorization'));
    if (!actor || actor.active !== true) throw new AnalysisError('unauthenticated');
    return actor;
}

function operationFromPath(path) {
    const prefix = '/v1/analysis/';
    if (!path.startsWith(prefix)) return null;
    const operation = path.slice(prefix.length);
    return OPERATION_NAMES.includes(operation) ? operation : false;
}

// OAuth discovery must not depend on a database pool, a browser session, or
// the feature switch.  Clients need it before they can obtain the dedicated
// token; it intentionally reports only the fixed resource/issuer contract.
export function createCenterApiDiscoveryHandler({ basePath = '/center-api', protectedMetadata, enabled = false } = {}) {
    const normalized = normalizedBasePath(basePath);
    if (!protectedMetadata || typeof protectedMetadata.resource !== 'string' || !Array.isArray(protectedMetadata.authorization_servers)
        || protectedMetadata.authorization_servers.some(issuer => typeof issuer !== 'string') || typeof enabled !== 'boolean') {
        throw new AnalysisError('not_configured');
    }
    return request => {
        const path = relativePath(new URL(request.url).pathname, normalized);
        if (path === '/mcp/.well-known/oauth-protected-resource' && request.method === 'GET') {
            return json(protectedMetadata, 200, { 'Content-Type': 'application/json' });
        }
        if (path === '/health' && request.method === 'GET') {
            return json({ service: 'center-api', ready: enabled }, 200, { 'Content-Type': 'application/json' });
        }
        return null;
    };
}

// This HTTP layer has no database access.  It only enforces transport rules,
// hands a verified website actor to the shared service, and returns the same
// result object used by MCP.
export function createCenterApiHandler({
    basePath = '/center-api',
    resource,
    protectedMetadata,
    mcpHandler,
    analysisService,
    connectionService,
    authorizeWebsite,
    allowedWebOrigins = [],
} = {}) {
    const normalized = normalizedBasePath(basePath);
    if (typeof resource !== 'string' || !protectedMetadata || typeof mcpHandler !== 'function'
        || !analysisService || typeof analysisService.run !== 'function' || !connectionService
        || !Array.isArray(allowedWebOrigins) || allowedWebOrigins.some(origin => typeof origin !== 'string')) {
        throw new AnalysisError('not_configured');
    }
    return async request => {
        const path = relativePath(new URL(request.url).pathname, normalized);
        if (path === null) return json({ error: { code: 'not_found' } }, 404);
        if (request.method === 'GET' && path === '/mcp/.well-known/oauth-protected-resource') {
            return json(protectedMetadata, 200, { 'Content-Type': 'application/json' });
        }
        if (path === '/mcp') return mcpHandler(request);

        let origin;
        try { origin = requireWebOrigin(request, allowedWebOrigins); }
        catch (error) { return errorResponse(error); }
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: webHeaders(origin) });
        try {
            const actor = await websiteActor(request, authorizeWebsite);
            const operation = operationFromPath(path);
            if (operation === false) return json({ error: { code: 'not_found' } }, 404, webHeaders(origin));
            if (operation) {
                if (request.method !== 'POST') return json({ error: { code: 'method_not_allowed' } }, 405, webHeaders(origin));
                const input = await jsonBody(request);
                const result = await analysisService.run({ operation, input, actor });
                return json(result, 200, webHeaders(origin));
            }
            if (path === '/v1/connections') {
                if (request.method !== 'GET') return json({ error: { code: 'method_not_allowed' } }, 405, webHeaders(origin));
                return json(await connectionService.list(actor), 200, webHeaders(origin));
            }
            if (path === '/v1/connections/prepare') {
                if (request.method !== 'POST') return json({ error: { code: 'method_not_allowed' } }, 405, webHeaders(origin));
                return json(await connectionService.prepare(actor, await jsonBody(request)), 200, webHeaders(origin));
            }
            if (path === '/v1/connections/complete') {
                if (request.method !== 'POST') return json({ error: { code: 'method_not_allowed' } }, 405, webHeaders(origin));
                return json(await connectionService.complete(actor, await jsonBody(request)), 200, webHeaders(origin));
            }
            const revoke = path.match(/^\/v1\/connections\/([0-9a-f-]{36})\/revoke\/(begin|confirm)$/i);
            if (revoke) {
                if (request.method !== 'POST' || !UUID(revoke[1])) return json({ error: { code: 'invalid_input' } }, 400, webHeaders(origin));
                const output = revoke[2] === 'begin'
                    ? await connectionService.beginRevoke(actor, { connection_id: revoke[1] })
                    : await connectionService.confirmRevoke(actor, { connection_id: revoke[1] });
                return json(output, 200, webHeaders(origin));
            }
            return json({ error: { code: 'not_found' } }, 404, webHeaders(origin));
        } catch (error) {
            return errorResponse(error, origin);
        }
    };
}
