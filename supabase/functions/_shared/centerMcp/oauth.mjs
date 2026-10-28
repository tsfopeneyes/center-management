const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const bytes = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), c => c.charCodeAt(0));
const decode = value => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes(value)));
export const READ_SCOPES = Object.freeze(['center:statistics:read', 'center:programs:read']);

// This verifies a RESOURCE-BOUND OAuth JWT, not a normal website bearer.
// No key/credential is generated. loadJwks must use the configured issuer only.
export function createOAuthAuthenticator({ issuer, resource, clientId, allowedAuthUserId, allowedProfileId,
    loadJwks, loadAccountState, loadLiveGrant, cryptoApi = globalThis.crypto, now = Date.now } = {}) {
    return async token => {
        if (!issuer || !resource || !clientId || !uuid(allowedAuthUserId) || !uuid(allowedProfileId) ||
            typeof loadJwks !== 'function' || typeof loadAccountState !== 'function' || typeof loadLiveGrant !== 'function') throw new Error('not_configured');
        try {
            if (typeof token !== 'string' || token.length > 8192) return null;
            const parts = token.split('.');
            if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
            const header = decode(parts[0]);
            if (!['ES256', 'RS256'].includes(header.alg) || typeof header.kid !== 'string' || header.kid.length > 128 || header.crit || header.jku || header.jwk || header.x5u) return null;
            const keys = await loadJwks();
            const matches = keys?.keys?.filter(key => key.kid === header.kid && key.alg === header.alg && key.use === 'sig' &&
                (header.alg === 'ES256' ? key.kty === 'EC' && key.crv === 'P-256' : key.kty === 'RSA')) || [];
            if (matches.length !== 1) return null;
            const algorithm = header.alg === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
            const key = await cryptoApi.subtle.importKey('jwk', matches[0], algorithm, false, ['verify']);
            if (!await cryptoApi.subtle.verify(header.alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : algorithm,
                key, bytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]))) return null;
            const claims = decode(parts[1]), time = now() / 1000;
            // Supabase documents OIDC scopes, not custom center OAuth scopes.
            // These are separately reviewed application permission claims from
            // a trusted access-token hook, not requested unsupported scopes.
            const scopes = Array.isArray(claims.center_permissions) ? claims.center_permissions : [];
            // authenticated is the broad PostgREST audience and is deliberately
            // rejected. Resource binding must be reviewed before OAuth activation.
            if (claims.iss !== issuer || claims.aud !== resource || claims.client_id !== clientId || claims.sub !== allowedAuthUserId ||
                !uuid(claims.session_id) || claims.role !== 'center_mcp_oauth' || claims.is_anonymous === true ||
                !Number.isFinite(claims.exp) || claims.exp <= time || !Number.isFinite(claims.iat) || claims.iat > time ||
                claims.nbf != null && (!Number.isFinite(claims.nbf) || claims.nbf > time) ||
                READ_SCOPES.some(scope => !scopes.includes(scope)) || scopes.some(scope => !READ_SCOPES.includes(scope))) return null;
            const account = await loadAccountState(claims.sub);
            if (!account || account.authUserId !== allowedAuthUserId || account.profileId !== allowedProfileId || account.mappingVerified !== true ||
                account.status !== 'active' || account.mustChangePassword !== false || account.roleEnabled !== true ||
                !['admin', 'master'].includes(account.role) || !Number.isSafeInteger(account.credentialVersion) || account.credentialVersion < 1) return null;
            // Must verify LIVE native consent/session revocation + vetted website
            // login continuity. Never synthesize this just because JWT is valid.
            const grant = await loadLiveGrant(claims, account);
            if (grant?.active !== true || grant.authUserId !== claims.sub || grant.sessionId !== claims.session_id ||
                grant.clientId !== clientId || grant.profileId !== account.profileId || grant.credentialVersion !== account.credentialVersion) return null;
            return Object.freeze({ verified: true, active: true, subject: account.profileId, scopes: [...READ_SCOPES] });
        } catch { return null; }
    };
}

// Approval gate model only: native Auth owns code/PKCE/token/refresh operations.
// Caller reuses vetted account-auth authorization; no new login is implemented.
export async function assessOAuthConsent({ authorizeExistingSession, accessToken, client, expectedClientId, expectedProfileId, expectedAuthUserId }) {
    if (typeof authorizeExistingSession !== 'function') return { allowed: false };
    try {
        const actor = await authorizeExistingSession({ accessToken, action: 'members.manage' });
        return { allowed: actor.actorProfileId === expectedProfileId && actor.authUserId === expectedAuthUserId &&
            client?.id === expectedClientId && client?.reviewed === true };
    } catch { return { allowed: false }; }
}
