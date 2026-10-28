import { AnalysisError } from '../centerAnalysis/contracts.mjs';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const allowedCapabilities = Object.freeze(['analytics.read', 'programs.read']);

const requireActor = actor => {
    if (!actor || actor.active !== true || !uuid(actor.auth_user_id) || !uuid(actor.profile_id)
        || !Number.isSafeInteger(actor.credential_version) || actor.credential_version < 1
        || !['admin', 'master'].includes(actor.role)) throw new AnalysisError('forbidden');
    return actor;
};

const requireAuthorizationId = value => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(value)) throw new AnalysisError('invalid_input');
    return value;
};

const validNativeAuthorization = (authorization, { authorizationId, actor, resource }) => {
    if (!authorization || authorization.authorization_id !== authorizationId || !uuid(authorization.client_id)
        || authorization.user_id !== actor.auth_user_id || authorization.resource !== resource
        || !['pending', 'approved'].includes(authorization.status)
        || typeof authorization.redirect_uri !== 'string' || !authorization.redirect_uri.startsWith('https://')
        || String(authorization.code_challenge_method).toLowerCase() !== 's256'
        || typeof authorization.expires_at !== 'string' || !Number.isFinite(Date.parse(authorization.expires_at))) {
        throw new AnalysisError('forbidden');
    }
    return authorization;
};

// Native OAuth is deliberately injected.  The Supabase OAuth implementation is
// platform-managed and must be confirmed in P0 before this adapter is wired to
// managed auth tables or an official admin API.
const requireNativeAuthorizationReader = native => {
    if (!native || typeof native.readAuthorization !== 'function') {
        throw new AnalysisError('not_configured');
    }
    return native;
};

const requireNativeRevocationReader = native => {
    if (!native || typeof native.isGrantRevoked !== 'function') throw new AnalysisError('not_configured');
    return native;
};

export function createConnectionService({ store, nativeOAuth, config, now = () => new Date(), requestId = () => globalThis.crypto?.randomUUID?.() } = {}) {
    if (!store || typeof store.createConsentRequest !== 'function' || typeof store.activateConsentRequest !== 'function'
        || typeof store.beginRevoke !== 'function' || typeof store.finishRevoke !== 'function' || !config?.resource) {
        throw new AnalysisError('not_configured');
    }
    const newRequestId = () => {
        const id = requestId();
        if (!uuid(id)) throw new AnalysisError('temporarily_unavailable', { retryable: true });
        return id;
    };
    return Object.freeze({
        async list(actor) {
            const principal = requireActor(actor);
            if (typeof store.listOwn !== 'function') throw new AnalysisError('not_configured');
            return Object.freeze({ connections: await store.listOwn({ authUserId: principal.auth_user_id, profileId: principal.profile_id }) });
        },

        async prepare(actor, { authorization_id } = {}) {
            const principal = requireActor(actor);
            const authorizationId = requireAuthorizationId(authorization_id);
            const native = requireNativeAuthorizationReader(nativeOAuth);
            const authorization = validNativeAuthorization(await native.readAuthorization(authorizationId), { authorizationId, actor: principal, resource: config.resource });
            const expiration = Date.parse(authorization.expires_at);
            if (expiration <= new Date(typeof now === 'function' ? now() : now).getTime()) throw new AnalysisError('forbidden');
            const request = await store.createConsentRequest({
                id: newRequestId(),
                authorizationId,
                authUserId: principal.auth_user_id,
                profileId: principal.profile_id,
                clientId: authorization.client_id,
                redirectUri: authorization.redirect_uri,
                resource: config.resource,
                capabilities: allowedCapabilities,
                credentialVersion: principal.credential_version,
                expiresAt: authorization.expires_at,
            });
            return Object.freeze({
                request_id: request.request_id,
                client_label: request.client_label,
                capabilities: request.capabilities,
                expires_at: request.expires_at,
            });
        },

        async complete(actor, { request_id } = {}) {
            const principal = requireActor(actor);
            if (!uuid(request_id) || typeof store.loadPendingConsentRequest !== 'function') throw new AnalysisError('invalid_input');
            const pending = await store.loadPendingConsentRequest({ requestId: request_id, authUserId: principal.auth_user_id, profileId: principal.profile_id });
            if (!pending) throw new AnalysisError('forbidden');
            const native = requireNativeAuthorizationReader(nativeOAuth);
            const authorization = validNativeAuthorization(await native.readAuthorization(pending.authorization_id), {
                authorizationId: pending.authorization_id,
                actor: principal,
                resource: config.resource,
            });
            if (authorization.client_id !== pending.client_id || authorization.redirect_uri !== pending.redirect_uri
                || authorization.status !== 'approved') throw new AnalysisError('forbidden');
            const activated = await store.activateConsentRequest({
                requestId: request_id,
                authorizationId: pending.authorization_id,
                authUserId: principal.auth_user_id,
                profileId: principal.profile_id,
                clientId: pending.client_id,
                credentialVersion: principal.credential_version,
            });
            return Object.freeze({ connection_id: activated.connection_id, state: activated.state });
        },

        // Revoke is deliberately a two-party flow.  The server blocks its own
        // connection first, then the logged-in browser calls Supabase's
        // documented `auth.oauth.revokeGrant` API, and finally this service
        // confirms the native grant is gone.  The Edge Function never writes
        // managed Auth tables or receives a browser refresh token.
        async beginRevoke(actor, { connection_id } = {}) {
            const principal = requireActor(actor);
            if (!uuid(connection_id)) throw new AnalysisError('invalid_input');
            const started = await store.beginRevoke({ connectionId: connection_id, authUserId: principal.auth_user_id, profileId: principal.profile_id });
            if (started.state === 'revoked') return Object.freeze({ connection_id: started.id, state: 'revoked', client_id: null });
            return Object.freeze({ connection_id: started.id, state: 'revoke_pending', client_id: started.client_id });
        },

        async confirmRevoke(actor, { connection_id } = {}) {
            const principal = requireActor(actor);
            if (!uuid(connection_id) || typeof store.loadRevokePending !== 'function') throw new AnalysisError('invalid_input');
            const pending = await store.loadRevokePending({ connectionId: connection_id, authUserId: principal.auth_user_id, profileId: principal.profile_id });
            if (!pending) throw new AnalysisError('forbidden');
            const native = requireNativeRevocationReader(nativeOAuth);
            const revoked = await native.isGrantRevoked({ authUserId: principal.auth_user_id, clientId: pending.client_id });
            if (revoked !== true) return Object.freeze({ connection_id, state: 'revoke_pending' });
            const finished = await store.finishRevoke({ connectionId: connection_id, authUserId: principal.auth_user_id, profileId: principal.profile_id });
            return Object.freeze({ connection_id: finished.id, state: finished.state });
        },

        // This is retained for a trusted server-side worker only.  Browser
        // routes use beginRevoke/confirmRevoke so native revocation uses the
        // user's established Supabase OAuth session.
        async revoke(actor, { connection_id } = {}) {
            const principal = requireActor(actor);
            if (!uuid(connection_id)) throw new AnalysisError('invalid_input');
            const started = await store.beginRevoke({ connectionId: connection_id, authUserId: principal.auth_user_id, profileId: principal.profile_id });
            if (started.state === 'revoked') return Object.freeze({ connection_id: started.id, state: 'revoked' });
            try {
                const native = requireNativeAuthorizationReader(nativeOAuth);
                if (typeof native.revokeGrant !== 'function') return Object.freeze({ connection_id: started.id, state: 'revoke_pending' });
                await native.revokeGrant({ authUserId: principal.auth_user_id, clientId: started.client_id });
                const revoked = await store.finishRevoke({ connectionId: connection_id, authUserId: principal.auth_user_id, profileId: principal.profile_id });
                return Object.freeze({ connection_id: revoked.id, state: revoked.state });
            } catch {
                // Local access is already denied by revoke_pending.  Do not
                // retry by reactivating it or report native revocation as done.
                return Object.freeze({ connection_id: started.id, state: 'revoke_pending' });
            }
        },

        async reconcileRevocation(actor, { connection_id } = {}) {
            const principal = requireActor(actor);
            if (!uuid(connection_id) || typeof store.loadRevokePending !== 'function') throw new AnalysisError('invalid_input');
            const pending = await store.loadRevokePending({ connectionId: connection_id, authUserId: principal.auth_user_id, profileId: principal.profile_id });
            if (!pending) throw new AnalysisError('forbidden');
            const native = requireNativeRevocationReader(nativeOAuth);
            const revoked = await native.isGrantRevoked({ authUserId: principal.auth_user_id, clientId: pending.client_id });
            if (revoked !== true) return Object.freeze({ connection_id, state: 'revoke_pending' });
            const finished = await store.finishRevoke({ connectionId: connection_id, authUserId: principal.auth_user_id, profileId: principal.profile_id });
            return Object.freeze({ connection_id: finished.id, state: finished.state });
        },
    });
}
