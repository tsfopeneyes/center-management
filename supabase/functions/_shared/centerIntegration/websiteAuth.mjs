import { AnalysisError } from '../centerAnalysis/contracts.mjs';
import { extractBearerToken } from './oauth.mjs';

const UUID = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

// Database role/user metadata never authorizes a browser request on its own.
// `verifyWebsiteSession` is intentionally injected so the Edge entry cannot
// quietly fall back to decoded claims or the legacy live:true session stub.
export function createWebsiteActorAuthorizer({ verifyWebsiteSession, loadAccount } = {}) {
    if (typeof verifyWebsiteSession !== 'function' || typeof loadAccount !== 'function') throw new AnalysisError('not_configured');
    return async authorizationHeader => {
        const token = extractBearerToken(authorizationHeader);
        if (!token) return null;
        const session = await verifyWebsiteSession(token);
        if (!session || !UUID(session.auth_user_id) || !UUID(session.session_id)) return null;
        const account = await loadAccount(session.auth_user_id);
        if (!account || account.auth_user_id !== session.auth_user_id || !UUID(account.profile_id)
            || !Number.isSafeInteger(account.credential_version) || account.credential_version < 1
            || account.mapping_verified !== true || account.status !== 'active' || account.must_change_password === true
            || account.role_enabled !== true || account.integration_enabled !== true || !['admin', 'master'].includes(account.role)) return null;
        return Object.freeze({
            active: true,
            channel: 'web',
            auth_user_id: account.auth_user_id,
            profile_id: account.profile_id,
            credential_version: account.credential_version,
            role: account.role,
            capabilities: Object.freeze(['analytics.read', 'programs.read']),
        });
    };
}

export function createWebsiteAccountReader({ withReadTransaction } = {}) {
    if (typeof withReadTransaction !== 'function') throw new AnalysisError('not_configured');
    return async authUserId => {
        if (!UUID(authUserId)) throw new AnalysisError('unauthenticated');
        return withReadTransaction(async query => {
            const { rows } = await query(`
                SELECT a.auth_user_id::text AS auth_user_id, a.profile_id::text AS profile_id,
                       a.mapping_verified, a.status, a.credential_version, a.must_change_password,
                       role.role, role.enabled AS role_enabled,
                       EXISTS (
                         SELECT 1 FROM center_integration.settings setting
                         WHERE setting.singleton AND setting.enabled=true
                           AND a.profile_id=ANY(setting.pilot_profile_ids)
                       ) AS integration_enabled
                FROM center_integration.account_state a
                JOIN center_integration.account_roles role ON role.profile_id=a.profile_id
                WHERE a.auth_user_id=$1::uuid`, [authUserId]);
            if (!Array.isArray(rows) || rows.length > 1) throw new AnalysisError('source_incomplete');
            return rows.length === 1 ? Object.freeze(rows[0]) : null;
        });
    };
}
