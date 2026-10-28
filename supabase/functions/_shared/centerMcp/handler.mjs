import { createStatisticsBoundary } from '../operationStatistics/boundary.mjs';
import { approvedMetadata } from '../operationStatistics/publication.mjs';
import { READ_SCOPES } from './oauth.mjs';

const versions = ['2025-03-26', '2025-06-18'];
const schema = { type: 'object', additionalProperties: false, required: ['period'], properties: {
    period: { type: 'object', additionalProperties: false, required: ['kind', 'date'], properties: { kind: { enum: ['day', 'week', 'month'] }, date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } } },
    metrics: { type: 'array', minItems: 1, maxItems: 3, uniqueItems: true, items: { enum: ['visits', 'programs', 'duration'] } },
    compare: { enum: ['previous'] }, breakdown: { enum: ['none', 'program', 'session'] },
} };
export const TOOLS = Object.freeze([
    { name: 'get_center_statistics', description: 'Read reviewed aggregate center visits, duration and program applications. No person rows or identifiers.', inputSchema: schema,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    { name: 'get_program_catalog', description: 'Read only published and reviewed program descriptions. No participant lists or raw feedback.', inputSchema: { type: 'object', additionalProperties: false, properties: {} },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
]);
const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
const rpc = (id, result) => json({ jsonrpc: '2.0', id, result });
const error = (id, code, message, status = 200) => json({ jsonrpc: '2.0', id, error: { code, message } }, status);

// Stateless Streamable HTTP JSON transport. Not an OAuth server. No listener is
// started here; configuration is injected after separately approved setup.
export function createMcpHandler({ resource, issuer, authenticate, authorizedSubject, readSources, publicationPolicy, authorizeRelease, runStatistics, allowedOrigins = [], now } = {}) {
    let canonical;
    try { canonical = new URL(resource); if (canonical.protocol !== 'https:' || canonical.username || canonical.password || canonical.search || canonical.hash) canonical = null; } catch { canonical = null; }
    return async request => {
        if (!canonical || !issuer) return json({ error: 'not_configured' }, 503);
        const url = new URL(request.url), origin = request.headers.get('Origin');
        if (origin && !allowedOrigins.includes(origin)) return json({ error: 'forbidden' }, 403);
        const metadataPath = canonical.pathname + '/.well-known/oauth-protected-resource';
        const mountedPath = canonical.pathname.startsWith('/functions/v1/') ? canonical.pathname.slice('/functions/v1'.length) : canonical.pathname;
        if ([metadataPath, mountedPath + '/.well-known/oauth-protected-resource'].includes(url.pathname) && request.method === 'GET') return json({ resource, authorization_servers: [issuer], scopes_supported: ['openid'] });
        if (![canonical.pathname, mountedPath].includes(url.pathname)) return json({ error: 'not_found' }, 404);
        const challenge = { 'WWW-Authenticate': `Bearer resource_metadata="${resource}/.well-known/oauth-protected-resource", scope="openid"` };
        const authorization = request.headers.get('Authorization') || '';
        if (!/^Bearer [A-Za-z0-9._-]+$/.test(authorization) || authorization.length > 8200) return json({ error: 'unauthorized' }, 401, challenge);
        // Public discovery works before activation. Even a supplied bearer may
        // never initialize/list/call tools until the private runtime is ready.
        if (typeof authenticate !== 'function' || !authorizedSubject) return json({ error: 'not_configured' }, 503);
        let identity;
        try { identity = await authenticate(authorization.slice(7)); } catch { return json({ error: 'not_configured' }, 503); }
        if (!identity || identity.verified !== true || identity.active !== true || identity.subject !== authorizedSubject || !Array.isArray(identity.scopes) || READ_SCOPES.some(scope => !identity.scopes.includes(scope))) return json({ error: 'unauthorized' }, 401, challenge);
        if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
        if (!versions.includes(request.headers.get('MCP-Protocol-Version') || '2025-03-26')) return json({ error: 'unsupported_protocol' }, 400);
        const accept = request.headers.get('Accept') || '';
        if (!accept.includes('application/json') || !accept.includes('text/event-stream')) return json({ error: 'not_acceptable' }, 406);
        if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'unsupported_media_type' }, 415);
        // Stream body with a byte cap instead of trusting Content-Length.
        let input;
        try {
            const reader = request.body?.getReader(); if (!reader) return error(null, -32600, 'Invalid request', 400);
            const chunks = []; let size = 0;
            for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 16384) { await reader.cancel(); return json({ error: 'request_too_large' }, 413); } chunks.push(part.value); }
            const body = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
            input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
        } catch { return error(null, -32700, 'Parse error', 400); }
        if (!input || Array.isArray(input) || input.jsonrpc !== '2.0' || typeof input.method !== 'string' ||
            Object.keys(input).some(key => !['jsonrpc', 'id', 'method', 'params'].includes(key)) ||
            input.id != null && typeof input.id !== 'string' && !Number.isSafeInteger(input.id)) return error(null, -32600, 'Invalid request', 400);
        if (!Object.hasOwn(input, 'id')) return input.method === 'notifications/initialized' || input.method === 'notifications/cancelled' ? new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } }) : error(null, -32600, 'Invalid notification', 400);
        if (input.method === 'initialize') return rpc(input.id, { protocolVersion: versions.includes(input.params?.protocolVersion) ? input.params.protocolVersion : versions.at(-1), capabilities: { tools: {} }, serverInfo: { name: 'center-statistics-read', version: '0.1.0' } });
        if (input.method === 'ping') return rpc(input.id, {});
        if (input.method === 'tools/list') return rpc(input.id, { tools: TOOLS });
        if (input.method !== 'tools/call') return error(input.id, -32601, 'Method not found');
        const params = input.params;
        if (!params || Object.keys(params).some(key => !['name', 'arguments', '_meta'].includes(key)) || !TOOLS.some(tool => tool.name === params.name)) return error(input.id, -32602, 'Unknown read tool');
        let output;
        if (params.name === 'get_center_statistics') output = typeof runStatistics === 'function' ? await runStatistics(params.arguments, identity)
            : await createStatisticsBoundary({ authenticate: async () => identity, authorizedSubject, readSources, publicationPolicy, authorizeRelease, now })(params.arguments);
        else {
            if (!params.arguments || Array.isArray(params.arguments) || Object.keys(params.arguments).length) return error(input.id, -32602, 'Invalid arguments');
            if (publicationPolicy?.reviewed !== true || publicationPolicy?.metadataReviewed !== true) output = { status: 'unavailable', code: 'policy_review_required' };
            else output = { status: 'ok', programs: Object.values(publicationPolicy.catalog || {}).map(approvedMetadata).filter(Boolean) };
        }
        return rpc(input.id, { content: [{ type: 'text', text: JSON.stringify(output) }], structuredContent: output, isError: output.status !== 'ok' });
    };
}
