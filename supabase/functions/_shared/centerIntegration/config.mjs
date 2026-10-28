import { AnalysisError } from '../centerAnalysis/contracts.mjs';

const httpsUrl = value => {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash ? url : null;
    } catch { return null; }
};

const normalizedOrigin = value => {
    const url = httpsUrl(value);
    if (!url || url.pathname !== '/' && url.pathname !== '') return null;
    return url.origin;
};

const csv = value => typeof value === 'string' ? value.split(',').map(item => item.trim()).filter(Boolean) : [];

// Only non-secret configuration belongs here.  Database URLs, service keys,
// and OAuth client secrets must stay in host-managed secrets and never pass
// through an MCP response, browser bundle, or audit record.
export function createCenterIntegrationConfig({ env = name => globalThis.Deno?.env?.get(name), functionName = 'center-api' } = {}) {
    if (typeof env !== 'function' || !/^[a-z][a-z0-9-]{1,63}$/.test(functionName)) throw new AnalysisError('not_configured');
    const supabaseOrigin = normalizedOrigin(env('SUPABASE_URL'));
    if (!supabaseOrigin) throw new AnalysisError('not_configured');
    const functionBase = `${supabaseOrigin}/functions/v1/${functionName}`;
    // RFC 9728 binds a token to the actual protected endpoint.  Binding it to
    // the broader Edge Function URL would also make sibling web routes look
    // like valid resource audiences.
    const resource = `${functionBase}/mcp`;
    const issuer = `${supabaseOrigin}/auth/v1`;
    const webOrigins = csv(env('CENTER_INTEGRATION_WEB_ORIGINS')).map(normalizedOrigin);
    if (webOrigins.some(origin => !origin)) throw new AnalysisError('not_configured');
    // A missing allow-list must leave browser routes unavailable.  MCP has its
    // own OAuth boundary and does not use browser CORS as authorization.
    const configuredOrigins = webOrigins;
    return Object.freeze({
        resource,
        function_base: functionBase,
        issuer,
        function_name: functionName,
        web_origins: Object.freeze([...new Set(configuredOrigins)]),
        mcp_scope: 'openid',
        required_capabilities: Object.freeze(['analytics.read', 'programs.read']),
    });
}

export function protectedResourceMetadata(config) {
    if (!config?.resource || !config?.issuer) throw new AnalysisError('not_configured');
    return Object.freeze({ resource: config.resource, authorization_servers: Object.freeze([config.issuer]), scopes_supported: Object.freeze([config.mcp_scope]) });
}

export function isAllowedWebOrigin(config, origin) {
    return typeof origin === 'string' && config?.web_origins?.includes(origin);
}
