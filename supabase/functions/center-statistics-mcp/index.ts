import pg from 'npm:pg@8.22.0';
import { createMcpHandler } from '../_shared/centerMcp/handler.mjs';
import { createOAuthAuthenticator } from '../_shared/centerMcp/oauth.mjs';
import { createPostgresSourceReader, createAccountStateReader } from '../_shared/centerMcp/postgres.mjs';
import { createCenterRolePool, createConfigurationReader, createLiveGrantReader, createConsentService } from '../_shared/centerMcp/liveStore.mjs';
import { createConsentHandler } from '../_shared/centerMcp/consentHandler.mjs';
import { createIdentityHandler } from '../_shared/centerMcp/identityHandler.mjs';
import { createPublishedStatistics } from '../_shared/centerMcp/releaseStore.mjs';
import { createRoleBoundPool } from '../_shared/roleBoundPool.mjs';
import { createSessionReadStore, createSessionSnapshot } from '../_shared/sessionReadStore.mjs';
import { createVerifiedSessionReader } from '../_shared/verifiedSession.mjs';
import { createAccountAuthorization } from '../_shared/accountAuthorization.mjs';
import { RESOURCE, ISSUER, SUPABASE_ORIGIN, CALLBACK, CENTER_ORIGIN } from '../_shared/centerMcp/deployment.mjs';

const allowedOrigins = ['https://chatgpt.com'];
const preparation = createMcpHandler({ resource: RESOURCE, issuer: ISSUER, allowedOrigins });
let basePool: any;
const pool = () => {
    if (!basePool) {
        const databaseUrl = Deno.env.get('SUPABASE_DB_URL');
        if (!databaseUrl) throw new Error('not_configured');
        basePool = new pg.Pool({ connectionString: databaseUrl, max: 2, idleTimeoutMillis: 1000, connectionTimeoutMillis: 5000, application_name: 'center-statistics-mcp' });
        basePool.on('error', () => console.warn('[center-mcp] database unavailable'));
    }
    return basePool;
};
const loadJwks = async () => {
    const response = await fetch(ISSUER + '/.well-known/jwks.json', { redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('JWKS unavailable');
    return response.json();
};
const websiteAuthorization = () => {
    const websitePool = createRoleBoundPool(pool(), 'account_session_reader');
    const store = createSessionReadStore((sql: string, values: any[]) => websitePool.query(sql, values));
    const verifyToken = createVerifiedSessionReader({ supabaseUrl: SUPABASE_ORIGIN,
        publishableKey: Deno.env.get('SUPABASE_ANON_KEY'), loadLiveSession: store.loadLiveSession });
    return createAccountAuthorization({ verifyToken, snapshot: createSessionSnapshot(websitePool) });
};
Deno.serve(async request => {
    const url = new URL(request.url), consent = ['/functions/v1/center-statistics-mcp/consent/prepare','/center-statistics-mcp/consent/prepare'].includes(url.pathname);
    const identity = ['/functions/v1/center-statistics-mcp/consent/identity','/center-statistics-mcp/consent/identity'].includes(url.pathname);
    if (identity) {
        // Preflight/invalid requests require no account or configuration read.
        if (request.method !== 'GET' || !request.headers.get('Authorization') || request.headers.get('Origin') !== CENTER_ORIGIN)
            return createIdentityHandler({ origin: CENTER_ORIGIN })(request);
        try { return createIdentityHandler({ authorizeExistingSession: websiteAuthorization(), origin: CENTER_ORIGIN })(request); }
        catch { return createIdentityHandler({ origin: CENTER_ORIGIN })(request); }
    }
    // Discovery and blank credentials never read secrets or access private DB.
    if (!consent && (!request.headers.get('Authorization') || url.pathname.endsWith('/.well-known/oauth-protected-resource'))) return preparation(request);
    try {
        const readerPool = createCenterRolePool(pool());
        const config = await createConfigurationReader(readerPool)();
        if (!config) return consent ? createConsentHandler({ origin: CENTER_ORIGIN })(request) : preparation(request);
        if (consent) {
            const authorizeExistingSession = websiteAuthorization();
            const prepare = createConsentService({ pool: createCenterRolePool(pool(), 'center_mcp_consent_writer'), authorizeExistingSession, callback: CALLBACK, resource: RESOURCE });
            return createConsentHandler({ prepare, origin: CENTER_ORIGIN })(request);
        }
        const authenticate = createOAuthAuthenticator({ ...config, issuer: ISSUER, resource: RESOURCE, loadJwks,
            loadAccountState: createAccountStateReader({ pool: readerPool }), loadLiveGrant: createLiveGrantReader(readerPool) });
        const readSources = createPostgresSourceReader({ pool: readerPool });
        const runStatistics = createPublishedStatistics({ pool: createCenterRolePool(pool(), 'center_mcp_release_worker'), readSources,
            policy: config.publicationPolicy, subject: config.allowedProfileId });
        return createMcpHandler({ resource: RESOURCE, issuer: ISSUER, authenticate, authorizedSubject: config.allowedProfileId,
            readSources, publicationPolicy: config.publicationPolicy, runStatistics, allowedOrigins })(request);
    } catch {
        return consent ? createConsentHandler({ origin: CENTER_ORIGIN })(request)
            : Response.json({ error: 'not_configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
});
