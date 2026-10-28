import { AnalysisError } from '../centerAnalysis/contracts.mjs';

const UUID = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const AUTHORIZATION_ID = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(value);

// This reader deliberately has no mutation API.  Consent approval and grant
// revocation stay in Supabase Auth's user-facing OAuth endpoints; the server
// only verifies their current state through a least-privileged projection.
export function createNativeOAuthReader({ withReadTransaction } = {}) {
    if (typeof withReadTransaction !== 'function') throw new AnalysisError('not_configured');
    return Object.freeze({
        async readAuthorization(authorizationId) {
            if (!AUTHORIZATION_ID(authorizationId)) throw new AnalysisError('invalid_input');
            return withReadTransaction(async query => {
                const { rows } = await query(`
                    SELECT authorization_id, client_id::text AS client_id, user_id::text AS user_id,
                           status::text AS status, resource, redirect_uri, code_challenge_method, expires_at::text AS expires_at
                    FROM center_integration.auth_authorizations
                    WHERE authorization_id=$1`, [authorizationId]);
                if (!Array.isArray(rows) || rows.length > 1) throw new AnalysisError('source_incomplete');
                return rows.length === 1 ? Object.freeze(rows[0]) : null;
            });
        },

        async isGrantRevoked({ authUserId, clientId } = {}) {
            if (!UUID(authUserId) || !UUID(clientId)) throw new AnalysisError('invalid_input');
            return withReadTransaction(async query => {
                const { rows } = await query(`
                    SELECT NOT EXISTS (
                        SELECT 1
                        FROM center_integration.auth_consents consent
                        JOIN center_integration.auth_clients client ON client.id=consent.client_id
                        WHERE consent.user_id=$1::uuid AND consent.client_id=$2::uuid
                          AND consent.revoked_at IS NULL AND client.deleted_at IS NULL
                    ) AS revoked`, [authUserId, clientId]);
                if (!Array.isArray(rows) || rows.length !== 1 || typeof rows[0].revoked !== 'boolean') {
                    throw new AnalysisError('source_incomplete');
                }
                return rows[0].revoked;
            });
        },
    });
}
