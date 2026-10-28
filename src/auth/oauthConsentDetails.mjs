// These provider scopes describe sign-in and session renewal. Center data
// capabilities are independently checked by the read-only API on every call.
const supportedScopes = new Set(['openid', 'email', 'offline_access']);

export function consentDetails(value) {
    const scopes = typeof value?.scope === 'string' ? value.scope.split(/\s+/).filter(Boolean) : [];
    const clientName = typeof value?.client?.name === 'string' ? value.client.name.trim() : '';
    if (!value?.authorization_id || !scopes.includes('openid')
        || scopes.some(scope => !supportedScopes.has(scope))
        || !clientName || clientName.length > 160) return null;
    return { clientName };
}
