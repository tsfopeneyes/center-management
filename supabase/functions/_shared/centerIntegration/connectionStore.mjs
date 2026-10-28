import { AnalysisError } from '../centerAnalysis/contracts.mjs';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const capabilities = value => Array.isArray(value) && value.length > 0 && value.length <= 8
    && value.every(item => ['analytics.read', 'programs.read'].includes(item)) && new Set(value).size === value.length;
const asIso = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

const requireUuid = value => { if (!uuid(value)) throw new AnalysisError('invalid_input'); return value; };
const requireCapabilities = value => { if (!capabilities(value)) throw new AnalysisError('invalid_input'); return [...value].sort(); };

function requireTransaction(withTransaction) {
    if (typeof withTransaction !== 'function') throw new AnalysisError('not_configured');
    return withTransaction;
}

// The store owns only center_integration tables.  It never writes Supabase's
// managed auth schema; native grant state is checked separately by the service.
export function createConnectionStore({ withControlTransaction } = {}) {
    const transact = requireTransaction(withControlTransaction);
    return Object.freeze({
        async listOwn({ authUserId, profileId }) {
            requireUuid(authUserId); requireUuid(profileId);
            return transact(async query => {
                const { rows } = await query(`
                    SELECT c.id::text AS id, cl.client_label AS client_label, c.state,
                           c.capabilities, c.consented_at, c.revoked_at
                    FROM center_integration.connections c
                    JOIN center_integration.clients cl ON cl.client_id=c.client_id
                    WHERE c.auth_user_id=$1::uuid AND c.profile_id=$2::uuid
                    ORDER BY c.updated_at DESC, c.id`, [authUserId, profileId]);
                return rows.map(row => Object.freeze({
                    id: row.id,
                    client_label: row.client_label,
                    state: row.state,
                    capabilities: Object.freeze(Array.isArray(row.capabilities) ? [...row.capabilities] : []),
                    consented_at: row.consented_at || null,
                    revoked_at: row.revoked_at || null,
                }));
            });
        },

        // Existing active links remain active until a newly approved request is
        // completed.  A retry only creates a fresh short-lived request row.
        async createConsentRequest({ id, authorizationId, authUserId, profileId, clientId, redirectUri, resource, capabilities: requestedCapabilities, credentialVersion, expiresAt }) {
            requireUuid(id); requireUuid(authUserId); requireUuid(profileId); requireUuid(clientId);
            if (typeof authorizationId !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(authorizationId)
                || typeof redirectUri !== 'string' || redirectUri.length > 2048 || !/^https:\/\//.test(redirectUri)
                || typeof resource !== 'string' || resource.length > 2048 || !/^https:\/\//.test(resource)
                || !Number.isSafeInteger(credentialVersion) || credentialVersion < 1 || !asIso(expiresAt)) throw new AnalysisError('invalid_input');
            const granted = requireCapabilities(requestedCapabilities);
            return transact(async query => {
                const client = await query(`
                    SELECT client.client_id::text AS id, client.client_label, client.enabled, client.retired_at
                    FROM center_integration.clients client
                    JOIN center_integration.settings setting ON setting.singleton
                    WHERE client.client_id=$1::uuid AND client.resource=$2 AND $3=ANY(client.redirect_uris)
                      AND setting.enabled=true AND $4::uuid=ANY(setting.pilot_profile_ids)`, [clientId, resource, redirectUri, profileId]);
                if (client.rows.length !== 1 || client.rows[0].enabled !== true || client.rows[0].retired_at !== null) throw new AnalysisError('forbidden');
                const completed = await query(`SELECT r.id::text AS id,c.id::text AS connection_id,r.expires_at
                    FROM center_integration.consent_requests r JOIN center_integration.connections c ON c.id=r.connection_id
                    WHERE r.authorization_id=$1 AND r.auth_user_id=$2::uuid AND r.profile_id=$3::uuid
                      AND r.client_id=$4::uuid AND r.redirect_uri=$5 AND r.completed_at IS NOT NULL
                      AND c.state='active' AND c.native_authorization_id=r.authorization_id
                      AND c.auth_user_id=r.auth_user_id AND c.profile_id=r.profile_id AND c.client_id=r.client_id
                      AND c.credential_version=$6 AND r.expires_at>now()`,
                    [authorizationId,authUserId,profileId,clientId,redirectUri,credentialVersion]);
                if (completed.rows.length === 1) return Object.freeze({ request_id: completed.rows[0].id,
                    connection_id: completed.rows[0].connection_id, expires_at: completed.rows[0].expires_at,
                    client_label: client.rows[0].client_label, capabilities: Object.freeze(granted) });
                const connection = await query(`
                    INSERT INTO center_integration.connections
                      (auth_user_id,profile_id,client_id,state,capabilities,grant_version,credential_version)
                    VALUES ($1::uuid,$2::uuid,$3::uuid,'pending',$4::text[],1,$5)
                    ON CONFLICT (auth_user_id,client_id) DO UPDATE
                    SET profile_id=EXCLUDED.profile_id,
                        state=CASE WHEN center_integration.connections.state='active' THEN 'active' ELSE 'pending' END,
                        capabilities=EXCLUDED.capabilities,
                        credential_version=EXCLUDED.credential_version,
                        updated_at=now()
                    WHERE center_integration.connections.state <> 'revoke_pending'
                    RETURNING id::text AS id, state, capabilities, grant_version`,
                    [authUserId, profileId, clientId, granted, credentialVersion]);
                if (connection.rows.length !== 1) throw new AnalysisError('temporarily_unavailable', { retryable: true });
                const request = await query(`
                    INSERT INTO center_integration.consent_requests
                      (id,authorization_id,connection_id,auth_user_id,profile_id,client_id,redirect_uri,expires_at)
                    VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7,$8::timestamptz)
                    ON CONFLICT (authorization_id) DO UPDATE
                    SET connection_id=EXCLUDED.connection_id, auth_user_id=EXCLUDED.auth_user_id,
                        profile_id=EXCLUDED.profile_id, client_id=EXCLUDED.client_id, redirect_uri=EXCLUDED.redirect_uri, expires_at=EXCLUDED.expires_at,
                        completed_at=NULL
                    WHERE center_integration.consent_requests.completed_at IS NULL
                    RETURNING id::text AS id, connection_id::text AS connection_id, expires_at`,
                    [id, authorizationId, connection.rows[0].id, authUserId, profileId, clientId, redirectUri, expiresAt]);
                if (request.rows.length !== 1) throw new AnalysisError('forbidden');
                return Object.freeze({
                    request_id: request.rows[0].id,
                    connection_id: request.rows[0].connection_id,
                    expires_at: request.rows[0].expires_at,
                    client_label: client.rows[0].client_label,
                    capabilities: Object.freeze(granted),
                });
            }, { write: true });
        },

        async activateConsentRequest({ requestId, authorizationId, authUserId, profileId, clientId, credentialVersion }) {
            requireUuid(requestId); requireUuid(authUserId); requireUuid(profileId); requireUuid(clientId);
            if (typeof authorizationId !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(authorizationId)
                || !Number.isSafeInteger(credentialVersion) || credentialVersion < 1) throw new AnalysisError('invalid_input');
            return transact(async query => {
                const completed = await query(`SELECT c.id::text AS id,c.state,c.grant_version
                    FROM center_integration.consent_requests r JOIN center_integration.connections c ON c.id=r.connection_id
                    WHERE r.id=$1::uuid AND r.authorization_id=$2 AND r.auth_user_id=$3::uuid
                      AND r.profile_id=$4::uuid AND r.client_id=$5::uuid AND r.completed_at IS NOT NULL
                      AND r.expires_at>now() AND c.state='active' AND c.native_authorization_id=$2
                      AND c.auth_user_id=$3::uuid AND c.profile_id=$4::uuid AND c.client_id=$5::uuid AND c.credential_version=$6`,
                    [requestId,authorizationId,authUserId,profileId,clientId,credentialVersion]);
                if (completed.rows.length === 1) return Object.freeze({ connection_id: completed.rows[0].id,
                    state: completed.rows[0].state, grant_version: completed.rows[0].grant_version });
                const updated = await query(`
                    UPDATE center_integration.connections c
                    SET state='active', native_authorization_id=$2, grant_version=c.grant_version+1,
                        credential_version=$6, consented_at=now(), revoked_at=NULL, updated_at=now()
                    FROM center_integration.consent_requests r
                    WHERE r.id=$1::uuid AND r.authorization_id=$2 AND r.connection_id=c.id
                      AND r.auth_user_id=$3::uuid AND r.profile_id=$4::uuid AND r.client_id=$5::uuid
                      AND r.completed_at IS NULL AND r.expires_at>now()
                      AND c.auth_user_id=$3::uuid AND c.profile_id=$4::uuid AND c.client_id=$5::uuid
                      AND c.state IN ('active','pending')
                    RETURNING c.id::text AS id, c.state, c.grant_version`,
                    [requestId, authorizationId, authUserId, profileId, clientId, credentialVersion]);
                if (updated.rows.length !== 1) throw new AnalysisError('forbidden');
                const marked = await query(`UPDATE center_integration.consent_requests SET completed_at=now()
                    WHERE id=$1::uuid AND completed_at IS NULL RETURNING id`, [requestId]);
                if (marked.rows.length !== 1) throw new AnalysisError('temporarily_unavailable', { retryable: true });
                return Object.freeze({ connection_id: updated.rows[0].id, state: updated.rows[0].state, grant_version: updated.rows[0].grant_version });
            }, { write: true });
        },

        async loadPendingConsentRequest({ requestId, authUserId, profileId }) {
            requireUuid(requestId); requireUuid(authUserId); requireUuid(profileId);
            return transact(async query => {
                const { rows } = await query(`
                    SELECT r.authorization_id, r.client_id::text AS client_id, r.redirect_uri
                    FROM center_integration.consent_requests r
                    JOIN center_integration.connections c ON c.id=r.connection_id
                    WHERE r.id=$1::uuid AND r.auth_user_id=$2::uuid AND r.profile_id=$3::uuid
                      AND (r.completed_at IS NULL OR (c.state='active' AND c.native_authorization_id=r.authorization_id)) AND r.expires_at>now()
                      AND c.auth_user_id=$2::uuid AND c.profile_id=$3::uuid AND c.state IN ('active','pending')`,
                    [requestId, authUserId, profileId]);
                return rows.length === 1 ? Object.freeze(rows[0]) : null;
            });
        },

        async beginRevoke({ connectionId, authUserId, profileId }) {
            requireUuid(connectionId); requireUuid(authUserId); requireUuid(profileId);
            return transact(async query => {
                const { rows } = await query(`
                    UPDATE center_integration.connections
                    SET state=CASE WHEN state='revoked' THEN 'revoked' ELSE 'revoke_pending' END,
                        grant_version=CASE WHEN state='revoked' THEN grant_version ELSE grant_version+1 END,
                        revoked_at=coalesce(revoked_at,now()), updated_at=now()
                    WHERE id=$1::uuid AND auth_user_id=$2::uuid AND profile_id=$3::uuid
                    RETURNING id::text AS id, client_id::text AS client_id, state`, [connectionId, authUserId, profileId]);
                if (rows.length !== 1) throw new AnalysisError('forbidden');
                return Object.freeze(rows[0]);
            }, { write: true });
        },

        async finishRevoke({ connectionId, authUserId, profileId }) {
            requireUuid(connectionId); requireUuid(authUserId); requireUuid(profileId);
            return transact(async query => {
                const { rows } = await query(`
                    UPDATE center_integration.connections
                    SET state='revoked', native_authorization_id=NULL, updated_at=now()
                    WHERE id=$1::uuid AND auth_user_id=$2::uuid AND profile_id=$3::uuid
                      AND state IN ('revoke_pending','revoked')
                    RETURNING id::text AS id, state`, [connectionId, authUserId, profileId]);
                if (rows.length !== 1) throw new AnalysisError('forbidden');
                return Object.freeze(rows[0]);
            }, { write: true });
        },

        async loadRevokePending({ connectionId, authUserId, profileId }) {
            requireUuid(connectionId); requireUuid(authUserId); requireUuid(profileId);
            return transact(async query => {
                const { rows } = await query(`
                    SELECT id::text AS id, client_id::text AS client_id, state
                    FROM center_integration.connections
                    WHERE id=$1::uuid AND auth_user_id=$2::uuid AND profile_id=$3::uuid
                      AND state='revoke_pending'`, [connectionId, authUserId, profileId]);
                return rows.length === 1 ? Object.freeze(rows[0]) : null;
            });
        },

        // Returns only the minimum fields required for a live-token decision.
        // It intentionally does not select authorization codes, refresh hashes,
        // IPs, user agents, or OAuth client secrets.
        async loadActiveTokenState({ connectionId, authUserId, clientId, sessionId, grantVersion, credentialVersion }) {
            requireUuid(connectionId); requireUuid(authUserId); requireUuid(clientId); requireUuid(sessionId);
            if (!Number.isSafeInteger(grantVersion) || grantVersion < 1 || !Number.isSafeInteger(credentialVersion) || credentialVersion < 1) throw new AnalysisError('unauthenticated');
            return transact(async query => {
                const { rows } = await query(`
                    SELECT c.id::text AS connection_id, c.auth_user_id::text AS auth_user_id, c.profile_id::text AS profile_id,
                           c.client_id::text AS client_id, c.capabilities, c.grant_version, c.credential_version, c.state,
                           EXISTS (
                             SELECT 1 FROM center_integration.settings setting
                             WHERE setting.singleton AND setting.enabled=true
                               AND c.profile_id=ANY(setting.pilot_profile_ids)
                           ) AS integration_active,
                           EXISTS (
                             SELECT 1 FROM center_integration.account_state a
                             JOIN center_integration.account_roles r ON r.profile_id=a.profile_id
                             WHERE a.auth_user_id=c.auth_user_id AND a.profile_id=c.profile_id
                               AND a.mapping_verified=true AND a.status='active' AND a.must_change_password=false
                               AND a.credential_version=c.credential_version AND r.enabled=true AND r.role IN ('admin','master')
                           ) AS account_active,
                           EXISTS (
                             SELECT 1 FROM center_integration.auth_consents g
                             JOIN center_integration.auth_clients oc ON oc.id=g.client_id AND oc.deleted_at IS NULL
                             JOIN center_integration.auth_sessions s ON s.id=$4::uuid AND s.user_id=g.user_id AND s.oauth_client_id=g.client_id
                             WHERE g.user_id=c.auth_user_id AND g.client_id=c.client_id AND g.revoked_at IS NULL
                               AND c.native_authorization_id IS NOT NULL AND (s.not_after IS NULL OR s.not_after>now())
                           ) AS native_active
                    FROM center_integration.connections c
                    WHERE c.id=$1::uuid AND c.auth_user_id=$2::uuid AND c.client_id=$3::uuid
                      AND c.grant_version=$5 AND c.credential_version=$6`,
                    [connectionId, authUserId, clientId, sessionId, grantVersion, credentialVersion]);
                if (rows.length !== 1) return null;
                const row = rows[0];
                if (row.state !== 'active' || row.integration_active !== true || row.account_active !== true || row.native_active !== true) return null;
                return Object.freeze({
                    connection_id: row.connection_id,
                    auth_user_id: row.auth_user_id,
                    profile_id: row.profile_id,
                    client_id: row.client_id,
                    capabilities: Object.freeze(Array.isArray(row.capabilities) ? [...row.capabilities] : []),
                    grant_version: row.grant_version,
                    credential_version: row.credential_version,
                });
            });
        },
    });
}

// Fixed role wrapper for a pg-compatible pool.  This is intentionally kept
// separate from the store so synthetic tests can inject a transaction function.
export function createControlTransaction(pool, { role = 'center_integration_control_writer', statementTimeoutMs = 5000 } = {}) {
    if (!pool || typeof pool.connect !== 'function' || role !== 'center_integration_control_writer' || !Number.isSafeInteger(statementTimeoutMs) || statementTimeoutMs < 100 || statementTimeoutMs > 10_000) {
        throw new AnalysisError('not_configured');
    }
    return async (operation, { write = false } = {}) => {
        const client = await pool.connect();
        let begun = false;
        let discard = false;
        try {
            await client.query(write ? 'BEGIN' : 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
            begun = true;
            await client.query(`SET LOCAL ROLE "${role}"`);
            await client.query(`SET LOCAL statement_timeout='${statementTimeoutMs}ms'`);
            await client.query("SET LOCAL idle_in_transaction_session_timeout='10000ms'");
            const identity = await client.query('SELECT current_user AS role');
            if (identity.rows.length !== 1 || identity.rows[0].role !== role) throw new AnalysisError('not_configured');
            const result = await operation((sql, values = []) => client.query(sql, values));
            if (write) { await client.query('COMMIT'); begun = false; }
            return result;
        } catch (error) {
            if (error instanceof AnalysisError) throw error;
            throw new AnalysisError('temporarily_unavailable', { retryable: true });
        } finally {
            if (begun) {
                try { await client.query('ROLLBACK'); } catch { discard = true; }
            }
            client.release(discard);
        }
    };
}
