import { StatisticsError } from '../operationStatistics/policy.mjs';

// The base connection is platform-managed. Every application SQL statement is
// preceded by a transaction-local, fixed NOLOGIN role; never HTTP-controlled.
export function createCenterRolePool(basePool, role = 'center_statistics_reader') {
    if (!['center_statistics_reader', 'center_mcp_consent_writer', 'center_mcp_release_worker'].includes(role)) throw new Error('Unreviewed role');
    return { async connect() {
        const base = await basePool.connect(); let active = false, poisoned = false, released = false;
        return { async query(sql, values) {
            if (released) throw new Error('Connection released');
            const command = sql.trim().replace(/;$/, '').toUpperCase();
            if (command === 'BEGIN' || command === 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY') {
                if (active) throw new Error('Transaction already active');
                await base.query(sql);
                try { await base.query(`SET LOCAL ROLE "${role}"`); active = true; }
                catch (error) { try { await base.query('ROLLBACK'); } catch { poisoned = true; } throw error; }
                return { rows: [] };
            }
            if (!active) throw new Error('Role transaction required');
            const result = await base.query(sql, values);
            if (command === 'ROLLBACK' || command === 'COMMIT') active = false;
            return result;
        }, release: error => { released = true; base.release(error || poisoned || active); } };
    } };
}
export async function withCenterTransaction(pool, operation, write = false) {
    const client = await pool.connect(); let started = false, discard = false;
    try {
        await client.query(write ? 'BEGIN' : 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'); started = true;
        await client.query("SET LOCAL statement_timeout='5000ms'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout='15000ms'");
        const value = await operation(client);
        if (write) { await client.query('COMMIT'); started = false; }
        return value;
    } finally { if (started) try { await client.query('ROLLBACK'); } catch { discard = true; } client.release(discard); }
}
export function createConfigurationReader(pool) {
    return () => withCenterTransaction(pool, async client => {
        const { rows } = await client.query(`SELECT client_id::text AS "clientId", auth_user_id::text AS "allowedAuthUserId",
            profile_id::text AS "allowedProfileId", enabled, credential_version AS "credentialVersion",
            publication_policy AS "publicationPolicy" FROM center_mcp.configuration WHERE singleton=true`);
        if (rows.length !== 1 || rows[0].enabled !== true) return null;
        return rows[0];
    });
}
export function createLiveGrantReader(pool) {
    return (claims, account) => withCenterTransaction(pool, async client => {
        if (claims.center_credential_version !== account.credentialVersion) return null;
        const { rows } = await client.query(`SELECT EXISTS (
          SELECT 1 FROM center_mcp.configuration c
          JOIN center_mcp.consent_proofs p ON p.client_id=c.client_id AND p.auth_user_id=c.auth_user_id AND p.profile_id=c.profile_id
          JOIN auth.oauth_authorizations a ON a.authorization_id=p.authorization_id AND a.client_id=p.client_id AND a.user_id=p.auth_user_id
          JOIN auth.oauth_consents g ON g.user_id=p.auth_user_id AND g.client_id=p.client_id
          JOIN auth.oauth_clients oc ON oc.id=p.client_id
          JOIN auth.sessions s ON s.id=$1::uuid AND s.user_id=p.auth_user_id AND s.oauth_client_id=p.client_id
          WHERE c.singleton=true AND c.enabled=true AND c.auth_user_id=$2::uuid AND c.profile_id=$3::uuid AND c.client_id=$4::uuid
            AND c.credential_version=$5 AND p.credential_version=$5 AND p.revoked_at IS NULL
            AND a.status::text='approved' AND a.approved_at IS NOT NULL AND g.revoked_at IS NULL AND oc.deleted_at IS NULL
            AND s.created_at BETWEEN a.approved_at - interval '5 seconds' AND a.approved_at + interval '30 seconds'
            AND s.created_at >= g.granted_at - interval '5 seconds'
            AND (s.not_after IS NULL OR s.not_after>now())
        ) AS active`, [claims.session_id, claims.sub, account.profileId, claims.client_id, account.credentialVersion]);
        return rows[0]?.active === true ? { active: true, authUserId: claims.sub, profileId: account.profileId,
            sessionId: claims.session_id, clientId: claims.client_id, credentialVersion: account.credentialVersion } : null;
    });
}
// Validate a vetted website login against an operator-bound account, then
// bind that proof to a pending native authorization. Never approve Auth here.
export function createConsentService({ pool, authorizeExistingSession, callback, resource }) {
    return async ({ accessToken, authorizationId }) => {
        if (typeof authorizationId !== 'string' || authorizationId.length > 256 || !/^[A-Za-z0-9_-]+$/.test(authorizationId)) throw new StatisticsError('invalid_request');
        const actor = await authorizeExistingSession({ accessToken, action: 'members.manage' });
        return withCenterTransaction(pool, async client => {
            const { rows } = await client.query(`INSERT INTO center_mcp.consent_proofs
              (authorization_id,client_id,auth_user_id,profile_id,website_session_id,credential_version)
              SELECT a.authorization_id,c.client_id,c.auth_user_id,c.profile_id,$1::uuid,c.credential_version
              FROM center_mcp.configuration c JOIN auth.oauth_authorizations a ON a.client_id=c.client_id
              JOIN account_security.accounts ac ON ac.auth_user_id=c.auth_user_id AND ac.profile_id=c.profile_id
              JOIN account_security.account_roles r ON r.profile_id=c.profile_id
              JOIN account_security.session_assurances sa ON sa.session_id=$1::uuid AND sa.auth_user_id=c.auth_user_id AND sa.profile_id=c.profile_id
              WHERE c.singleton=true AND c.enabled=true AND c.auth_user_id=$2::uuid AND c.profile_id=$3::uuid
                AND ac.mapping_verified=true AND ac.status='active' AND ac.must_change_password=false
                AND ac.credential_version=c.credential_version AND r.enabled=true AND r.role IN ('admin','master')
                AND sa.status='trusted' AND sa.credential_version=c.credential_version
                AND a.authorization_id=$4 AND a.status::text='pending' AND a.expires_at>now()
                AND (a.user_id IS NULL OR a.user_id=c.auth_user_id) AND a.redirect_uri=$5
                AND (a.resource IS NULL OR a.resource=$6) AND lower(a.code_challenge_method::text)='s256'
              ON CONFLICT (authorization_id) DO NOTHING RETURNING authorization_id`,
            [actor.sessionId, actor.authUserId, actor.actorProfileId, authorizationId, callback, resource]);
            // Duplicate prepare may arise from a retried request. Fail closed;
            // request a new authorization rather than reviving revoked proof.
            if (rows.length !== 1) throw new StatisticsError('forbidden');
            return { allowed: true };
        }, true);
    };
}
