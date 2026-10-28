import { AnalysisError } from '../centerAnalysis/contracts.mjs';

const UUID = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

function decodeClaims(token) {
    if (typeof token !== 'string' || token.length < 16 || token.length > 8_192) return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
    try {
        const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(encoded), character => character.charCodeAt(0))));
    } catch { return null; }
}

function validIssuer(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
    } catch { return false; }
}

// Auth's /user endpoint verifies the bearer with the managed provider.  The
// decoded claims below are only a post-verification binding to the exact live
// session row; decoding alone never authenticates a request.
export function createManagedWebsiteSessionVerifier({ issuer, publishableKey, loadLiveSession, fetcher = fetch, now = Date.now } = {}) {
    if (!validIssuer(issuer) || typeof publishableKey !== 'string' || !publishableKey || typeof loadLiveSession !== 'function'
        || typeof fetcher !== 'function' || typeof now !== 'function') throw new AnalysisError('not_configured');
    return async token => {
        const claims = decodeClaims(token);
        const time = now() / 1_000;
        if (!claims || !UUID(claims.sub) || !UUID(claims.session_id) || claims.iss !== issuer || claims.aud !== 'authenticated'
            || claims.role !== 'authenticated' || claims.is_anonymous === true || !Number.isFinite(claims.exp) || claims.exp <= time) return null;
        let response;
        try {
            response = await fetcher(`${issuer}/user`, {
                method: 'GET', redirect: 'error', cache: 'no-store', credentials: 'omit',
                headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
            });
        } catch { throw new AnalysisError('temporarily_unavailable', { retryable: true }); }
        if (response.status === 401 || response.status === 403) return null;
        if (!response.ok) throw new AnalysisError('temporarily_unavailable', { retryable: true });
        let user;
        try { user = await response.json(); }
        catch { throw new AnalysisError('temporarily_unavailable', { retryable: true }); }
        if (!user || user.id !== claims.sub || user.is_anonymous === true) return null;
        const session = await loadLiveSession(claims.session_id, claims.sub);
        if (!session || session.session_id !== claims.session_id || session.auth_user_id !== claims.sub || session.live !== true) return null;
        return Object.freeze({ auth_user_id: claims.sub, session_id: claims.session_id });
    };
}

export function createManagedWebsiteSessionReader({ withReadTransaction } = {}) {
    if (typeof withReadTransaction !== 'function') throw new AnalysisError('not_configured');
    return async (sessionId, authUserId) => {
        if (!UUID(sessionId) || !UUID(authUserId)) throw new AnalysisError('unauthenticated');
        return withReadTransaction(async query => {
            const { rows } = await query(`
                SELECT id::text AS session_id, user_id::text AS auth_user_id
                FROM center_integration.auth_sessions
                WHERE id=$1::uuid AND user_id=$2::uuid
                  AND (not_after IS NULL OR not_after>now())`, [sessionId, authUserId]);
            if (!Array.isArray(rows) || rows.length > 1) throw new AnalysisError('source_incomplete');
            return rows.length === 1 ? Object.freeze({ ...rows[0], live: true }) : null;
        });
    };
}
