import { AnalysisError } from '../centerAnalysis/contracts.mjs';

const UUID = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const PERMISSIONS = Object.freeze(['analytics.read', 'programs.read']);
const encoder = new TextEncoder();

const base64UrlBytes = value => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new AnalysisError('unauthenticated');
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
};

const parseJson = value => {
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(base64UrlBytes(value))); }
    catch { throw new AnalysisError('unauthenticated'); }
};

const sameArray = (left, right) => left.length === right.length && left.every((item, index) => item === right[index]);
const canonicalPermissions = value => {
    if (!Array.isArray(value) || !value.length || value.some(item => !PERMISSIONS.includes(item)) || new Set(value).size !== value.length) {
        throw new AnalysisError('unauthenticated');
    }
    return [...value].sort();
};

function keyAlgorithm(algorithm) {
    if (algorithm === 'ES256') return { import: { name: 'ECDSA', namedCurve: 'P-256' }, verify: { name: 'ECDSA', hash: 'SHA-256' } };
    if (algorithm === 'RS256') return { import: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verify: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } };
    throw new AnalysisError('unauthenticated');
}

function validHeader(header) {
    return header && typeof header === 'object' && !Array.isArray(header)
        && ['ES256', 'RS256'].includes(header.alg) && typeof header.kid === 'string' && header.kid.length > 0 && header.kid.length <= 128
        && !Object.hasOwn(header, 'crit') && !Object.hasOwn(header, 'jku') && !Object.hasOwn(header, 'jwk') && !Object.hasOwn(header, 'x5u');
}

function matchKey(keys, header) {
    const matches = Array.isArray(keys?.keys) ? keys.keys.filter(key => key && key.kid === header.kid && key.alg === header.alg && key.use === 'sig'
        && (header.alg === 'ES256' ? key.kty === 'EC' && key.crv === 'P-256' : key.kty === 'RSA')) : [];
    if (matches.length !== 1) throw new AnalysisError('unauthenticated');
    return matches[0];
}

// This verifies a resource-bound integration access token.  It is not a
// website session verifier and it does not make a database authorization
// decision; createMcpAuthorizer performs the live connection/grant checks.
export function createMcpTokenVerifier({ issuer, resource, loadJwks, cryptoApi = globalThis.crypto, now = Date.now } = {}) {
    if (typeof issuer !== 'string' || !/^https:\/\//.test(issuer) || typeof resource !== 'string' || !/^https:\/\//.test(resource)
        || typeof loadJwks !== 'function' || !cryptoApi?.subtle || typeof now !== 'function') throw new AnalysisError('not_configured');
    return async token => {
        try {
            if (typeof token !== 'string' || token.length < 16 || token.length > 8192) return null;
            const parts = token.split('.');
            if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
            const header = parseJson(parts[0]);
            if (!validHeader(header)) return null;
            const algorithm = keyAlgorithm(header.alg);
            let jwks;
            try { jwks = await loadJwks(); }
            catch { throw new AnalysisError('temporarily_unavailable', { retryable: true }); }
            const jwk = matchKey(jwks, header);
            const publicKey = await cryptoApi.subtle.importKey('jwk', jwk, algorithm.import, false, ['verify']);
            const verified = await cryptoApi.subtle.verify(algorithm.verify, publicKey, base64UrlBytes(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
            if (!verified) return null;
            const claims = parseJson(parts[1]);
            const time = now() / 1000;
            const permissions = canonicalPermissions(claims.center_permissions);
            if (claims.iss !== issuer || claims.aud !== resource || claims.role !== 'center_integration_token'
                || !UUID(claims.sub) || !UUID(claims.session_id) || !UUID(claims.client_id) || !UUID(claims.center_connection_id)
                || !Number.isSafeInteger(claims.center_grant_version) || claims.center_grant_version < 1
                || !Number.isSafeInteger(claims.center_credential_version) || claims.center_credential_version < 1
                || !Number.isFinite(claims.exp) || claims.exp <= time || !Number.isFinite(claims.iat) || claims.iat > time + 30
                || claims.nbf != null && (!Number.isFinite(claims.nbf) || claims.nbf > time + 30)
                || claims.is_anonymous === true) return null;
            return Object.freeze({
                auth_user_id: claims.sub,
                session_id: claims.session_id,
                client_id: claims.client_id,
                connection_id: claims.center_connection_id,
                grant_version: claims.center_grant_version,
                credential_version: claims.center_credential_version,
                capabilities: Object.freeze(permissions),
                expires_at: claims.exp,
            });
        } catch (error) {
            if (error instanceof AnalysisError && error.code === 'temporarily_unavailable') throw error;
            return null;
        }
    };
}

export function extractBearerToken(header) {
    if (typeof header !== 'string' || !/^Bearer [A-Za-z0-9._-]+$/.test(header) || header.length > 8200) return null;
    return header.slice(7);
}

export function createMcpAuthorizer({ verifyToken, connectionStore } = {}) {
    if (typeof verifyToken !== 'function' || !connectionStore || typeof connectionStore.loadActiveTokenState !== 'function') throw new AnalysisError('not_configured');
    return async authorizationHeader => {
        const token = extractBearerToken(authorizationHeader);
        if (!token) return null;
        const claims = await verifyToken(token);
        if (!claims) return null;
        const state = await connectionStore.loadActiveTokenState({
            connectionId: claims.connection_id,
            authUserId: claims.auth_user_id,
            clientId: claims.client_id,
            sessionId: claims.session_id,
            grantVersion: claims.grant_version,
            credentialVersion: claims.credential_version,
        });
        if (!state || state.connection_id !== claims.connection_id || state.auth_user_id !== claims.auth_user_id
            || state.client_id !== claims.client_id || state.grant_version !== claims.grant_version
            || state.credential_version !== claims.credential_version || !sameArray([...state.capabilities].sort(), [...claims.capabilities].sort())) return null;
        return Object.freeze({
            active: true,
            channel: 'mcp',
            auth_user_id: state.auth_user_id,
            profile_id: state.profile_id,
            connection_id: state.connection_id,
            capabilities: Object.freeze([...state.capabilities]),
        });
    };
}
