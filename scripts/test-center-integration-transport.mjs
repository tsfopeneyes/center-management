import assert from 'node:assert/strict';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';
import * as z from 'zod';
import {
    createCenterMcpRequestHandler,
    mcpAuthenticationChallenge,
    protectedResourceMetadata,
} from '../supabase/functions/_shared/centerIntegration/mcp.mjs';

const resource = 'https://example.supabase.co/functions/v1/center-api/mcp';
const issuer = 'https://example.supabase.co/auth/v1';
const actor = Object.freeze({ active: true, capabilities: Object.freeze(['analytics.read', 'programs.read']) });
let calls = [];
const handler = createCenterMcpRequestHandler({
    Server,
    WebStandardStreamableHTTPServerTransport,
    CallToolRequestSchema,
    ListToolsRequestSchema,
    toJsonSchemaCompat,
    z,
    resource,
    issuer,
    authorize: async header => header === 'Bearer synthetic-token' ? actor : null,
    runOperation: async invocation => {
        calls.push(invocation);
        return Object.freeze({
            schema_version: 'center-analysis.v1',
            definition_version: 'synthetic',
            request_id: 'synthetic-request',
            status: 'ok',
            as_of: '2026-02-01T00:00:00.000Z',
            timezone: 'Asia/Seoul',
            basis: 'recorded_current_state',
            cache: { hit: false, generated_at: '2026-02-01T00:00:00.000Z', expires_at: null },
            data: { definitions: [] },
            quality: { status: 'complete', observation_start: null, observation_end_exclusive: null, reasons: [] },
            warnings: [],
            sources: [],
        });
    },
});

const request = (body, headers = {}) => new Request(resource, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify(body),
});
const rpc = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params });
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`CENTER TRANSPORT PASS ${name}`); };

await check('protected-resource metadata keeps the resource and issuer exact', async () => {
    assert.deepEqual(protectedResourceMetadata({ resource, issuer }), {
        resource,
        authorization_servers: [issuer],
        scopes_supported: ['openid'],
    });
    assert.match(mcpAuthenticationChallenge(resource, { error: 'invalid_token' }), /resource_metadata="https:\/\/example\.supabase\.co\/functions\/v1\/center-api\/mcp\/\.well-known\/oauth-protected-resource"/);
});

await check('unauthenticated discovery lists fixed tools without source work', async () => {
    const response = await handler(request(rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } })));
    assert.equal(response.status, 200);
    assert.equal(calls.length, 0);
    const listed = await handler(request(rpc(2, 'tools/list'), { 'MCP-Protocol-Version': '2025-06-18' }));
    assert.equal(listed.status, 200);
    const payload = await listed.json();
    assert.equal(payload.result.tools.length, 7);
    for (const tool of payload.result.tools.filter(row => !['get_analysis_capabilities','get_metric_definitions'].includes(row.name))) {
        assert.deepEqual(tool.inputSchema.properties.site.enum,['ALL','HAIFN','ENOUGH_PLACE']);
        assert.ok(!tool.inputSchema.required?.includes('site'));
    }
    assert.ok(payload.result.tools.every(tool => Array.isArray(tool.securitySchemes) && tool.securitySchemes[0]?.type === 'oauth2'));
});

await check('unauthenticated tool calls return the MCP OAuth challenge without source work', async () => {
    const response = await handler(request(rpc(3, 'tools/call', { name: 'get_metric_definitions', arguments: {} }), {
        'MCP-Protocol-Version': '2025-06-18',
    }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.result.isError, true);
    assert.match(payload.result._meta?.['mcp/www_authenticate']?.[0] || '', /resource_metadata=/);
    assert.equal(calls.length, 0);
});

await check('authorization infrastructure errors return a retryable service response', async () => {
    const unavailable = createCenterMcpRequestHandler({
        Server,
        WebStandardStreamableHTTPServerTransport,
        CallToolRequestSchema,
        ListToolsRequestSchema,
        toJsonSchemaCompat,
        z,
        resource,
        issuer,
        authorize: async () => { throw new Error('jwks unavailable'); },
        runOperation: async () => ({ status: 'ok' }),
    });
    const response = await unavailable(request(rpc(10, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }), { Authorization: 'Bearer synthetic-token' }));
    assert.equal(response.status, 503);
    assert.equal(calls.length, 0);
});

await check('authenticated initialize advertises only fixed read-only tools', async () => {
    const response = await handler(request(rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }), { Authorization: 'Bearer synthetic-token' }));
    assert.equal(response.status, 200);
    const message = await response.json();
    assert.equal(message.result.serverInfo.name, 'center-operations');
    const listed = await handler(request(rpc(2, 'tools/list'), { Authorization: 'Bearer synthetic-token', 'MCP-Protocol-Version': '2025-06-18' }));
    assert.equal(listed.status, 200);
    const payload = await listed.json();
    assert.deepEqual(payload.result.tools.map(tool => tool.name).sort(), [
        'analyze_program_engagement', 'analyze_program_visit_change', 'analyze_revisits',
        'get_analysis_capabilities', 'get_metric_definitions', 'get_operation_summary', 'get_program_catalog',
    ]);
    assert.ok(payload.result.tools.every(tool => tool.annotations?.readOnlyHint === true && tool.annotations?.destructiveHint === false));
    assert.ok(payload.result.tools.every(tool => tool.securitySchemes?.[0]?.type === 'oauth2'));
});

await check('tool call receives the authenticated actor and returns structured core output', async () => {
    const response = await handler(request(rpc(3, 'tools/call', { name: 'get_metric_definitions', arguments: {} }), {
        Authorization: 'Bearer synthetic-token',
        'MCP-Protocol-Version': '2025-06-18',
    }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].operation, 'get_metric_definitions');
    assert.equal(calls[0].actor, actor);
    assert.equal(payload.result.structuredContent.schema_version, 'center-analysis.v1');
    assert.equal(payload.result.content[0].type, 'text');
});

await check('SDK schema rejects a free-form analytic payload before core execution', async () => {
    const response = await handler(request(rpc(4, 'tools/call', { name: 'get_metric_definitions', arguments: { metric_ids: ['visit_sessions'], sql: 'select *' } }), {
        Authorization: 'Bearer synthetic-token',
        'MCP-Protocol-Version': '2025-06-18',
    }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.result.isError, true);
    assert.equal(calls.length, 1);
});

console.log(`${passed} MCP transport checks passed`);
