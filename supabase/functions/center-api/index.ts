import pg from 'npm:pg@8.22.0';
import { Server } from 'npm:@modelcontextprotocol/sdk@1.32.1/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@1.32.1/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from 'npm:@modelcontextprotocol/sdk@1.32.1/types.js';
import { toJsonSchemaCompat } from 'npm:@modelcontextprotocol/sdk@1.32.1/server/zod-json-schema-compat.js';
import * as z from 'npm:zod@3.25.76';
import { createRetryableRuntime } from '../_shared/retryableRuntime.mjs';
import { createCenterAnalysisService } from '../_shared/centerAnalysis/service.mjs';
import { createAnalysisReadTransaction, createPostgresAnalysisRepository } from '../_shared/centerAnalysis/postgresRepository.mjs';
import { createCenterIntegrationConfig } from '../_shared/centerIntegration/config.mjs';
import { createConnectionStore, createControlTransaction } from '../_shared/centerIntegration/connectionStore.mjs';
import { createConnectionService } from '../_shared/centerIntegration/connectionService.mjs';
import { createNativeOAuthReader } from '../_shared/centerIntegration/nativeOAuthStore.mjs';
import { createMcpAuthorizer, createMcpTokenVerifier } from '../_shared/centerIntegration/oauth.mjs';
import { createCenterMcpRequestHandler, protectedResourceMetadata } from '../_shared/centerIntegration/mcp.mjs';
import { createCenterApiDiscoveryHandler, createCenterApiHandler } from '../_shared/centerIntegration/http.mjs';
import { createManagedWebsiteSessionReader, createManagedWebsiteSessionVerifier } from '../_shared/centerIntegration/websiteSessionVerifier.mjs';
import { createWebsiteAccountReader, createWebsiteActorAuthorizer } from '../_shared/centerIntegration/websiteAuth.mjs';

const required = (name:string) => {
    const value = Deno.env.get(name)?.trim();
    if (!value) throw new Error(`Missing ${name}`);
    return value;
};

const boolean = (name:string) => Deno.env.get(name)?.trim() === 'true';

const functionBasePath = '/center-api';
let pool: any = null;

// Discovery is deliberately constructed outside the database-backed runtime.
// It stays available while the feature switch is off so OAuth clients can read
// the exact resource/issuer contract without turning on analysis access.
const discovery = (() => {
    try {
        const config = createCenterIntegrationConfig();
        return createCenterApiDiscoveryHandler({
            basePath: functionBasePath,
            protectedMetadata: protectedResourceMetadata({ resource: config.resource, issuer: config.issuer }),
            enabled: boolean('CENTER_API_READY'),
        });
    } catch {
        return null;
    }
})();

const runtime = createRetryableRuntime(async () => {
    // This explicit switch remains false until the reviewed schema, managed
    // OAuth contract, and production readiness checks are approved.  The
    // implementation must never become live merely because the function was
    // deployed alongside another feature.
    if (!boolean('CENTER_API_READY')) throw new Error('Center API is disabled');
    const config = createCenterIntegrationConfig();
    const databaseUrl = Deno.env.get('CENTER_INTEGRATION_DATABASE_URL')?.trim() || required('SUPABASE_DB_URL');
    const publishableKey = required('SUPABASE_ANON_KEY');
    pool = new pg.Pool({
        connectionString: databaseUrl,
        max: 2,
        idleTimeoutMillis: 1_000,
        connectionTimeoutMillis: 5_000,
        application_name: 'center-api',
    });
    pool.on('error', () => console.warn('[center-api] idle database connection unavailable'));
    const reader = createAnalysisReadTransaction(pool);
    const repository = createPostgresAnalysisRepository({ pool });
    const analysisService = createCenterAnalysisService({ repository });
    const connectionStore = createConnectionStore({ withControlTransaction: createControlTransaction(pool) });
    const nativeOAuth = createNativeOAuthReader({ withReadTransaction: reader });
    const connectionService = createConnectionService({ store: connectionStore, nativeOAuth, config });
    const loadJwks = async () => {
        const response = await fetch(`${config.issuer}/.well-known/jwks.json`, { cache: 'no-store', redirect: 'error' });
        if (!response.ok) throw new Error('JWKS unavailable');
        return await response.json();
    };
    const verifyMcpToken = createMcpTokenVerifier({ issuer: config.issuer, resource: config.resource, loadJwks });
    const authorizeMcp = createMcpAuthorizer({ verifyToken: verifyMcpToken, connectionStore });
    const mcpHandler = createCenterMcpRequestHandler({
        Server,
        WebStandardStreamableHTTPServerTransport,
        CallToolRequestSchema,
        ListToolsRequestSchema,
        toJsonSchemaCompat,
        z,
        resource: config.resource,
        issuer: config.issuer,
        authorize: authorizeMcp,
        runOperation: invocation => analysisService.run(invocation),
    });

    // Session-row behaviour after logout/revoke is a managed Auth contract.
    // The code is ready, but is gated until P0 validates it against this exact
    // project.  This keeps web consent/management routes fail-closed while MCP
    // metadata and its independent OAuth path remain reviewable.
    const authorizeWebsite = boolean('CENTER_WEBSITE_SESSION_CONTRACT_READY')
        ? createWebsiteActorAuthorizer({
            verifyWebsiteSession: createManagedWebsiteSessionVerifier({
                issuer: config.issuer,
                publishableKey,
                loadLiveSession: createManagedWebsiteSessionReader({ withReadTransaction: reader }),
            }),
            loadAccount: createWebsiteAccountReader({ withReadTransaction: reader }),
        })
        : async () => { throw new Error('Website session contract is not enabled'); };

    return createCenterApiHandler({
        basePath: functionBasePath,
        resource: config.resource,
        protectedMetadata: protectedResourceMetadata({ resource: config.resource, issuer: config.issuer }),
        mcpHandler,
        analysisService,
        connectionService,
        authorizeWebsite,
        allowedWebOrigins: config.web_origins,
    });
});

Deno.serve(async request => {
    const discoveryResponse = discovery?.(request);
    if (discoveryResponse) return discoveryResponse;
    try {
        return await (await runtime())(request);
    } catch {
        return Response.json({ error: { code: 'not_configured' } }, {
            status: 503,
            headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
        });
    }
});
