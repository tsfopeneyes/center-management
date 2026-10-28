import { createMcpHandler } from './handler.mjs';
import { createOAuthAuthenticator } from './oauth.mjs';
import { createPostgresSourceReader, createAccountStateReader } from './postgres.mjs';

// All settings/dependencies are supplied on the trusted server. This factory
// never enables Auth, registers clients, creates credentials or alters grants.
export function createCenterMcpRuntime({ pool, loadJwks, loadLiveGrant, oauth = {}, ...options } = {}) {
    const authenticate = createOAuthAuthenticator({ ...oauth, loadJwks, loadLiveGrant, loadAccountState: createAccountStateReader({ pool }) });
    return createMcpHandler({ ...options, resource: oauth.resource, issuer: oauth.issuer,
        authorizedSubject: oauth.allowedProfileId, authenticate, readSources: createPostgresSourceReader({ pool }) });
}
