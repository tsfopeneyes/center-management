import { supabase, supabaseUrl } from '../supabaseClient';

const MAX_RESPONSE_BYTES = 256 * 1024;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export class CenterIntegrationApiError extends Error {
    constructor(code = 'temporarily_unavailable', status = 0) {
        super(code);
        this.name = 'CenterIntegrationApiError';
        this.code = code;
        this.status = status;
    }
}

const isLocalHttpUrl = url => import.meta.env.DEV
    && url.protocol === 'http:'
    && LOCAL_HOSTS.has(url.hostname);

function centerApiBaseUrl() {
    const configured = typeof import.meta.env.VITE_CENTER_API_URL === 'string'
        ? import.meta.env.VITE_CENTER_API_URL.trim()
        : '';
    const fallback = typeof supabaseUrl === 'string' && supabaseUrl.trim()
        ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/center-api`
        : '';
    let url;
    try {
        url = new URL(configured || (import.meta.env.DEV ? `${window.location.origin}/center-api-local` : fallback));
    } catch {
        throw new CenterIntegrationApiError('not_configured');
    }
    if ((url.protocol !== 'https:' && !isLocalHttpUrl(url)) || url.username || url.password || url.search || url.hash) {
        throw new CenterIntegrationApiError('not_configured');
    }
    return url.href.replace(/\/+$/, '');
}

function endpointPath(path) {
    if (typeof path !== 'string' || !/^\/[a-z0-9/_-]{1,256}$/i.test(path) || path.includes('//') || path.includes('..')) {
        throw new CenterIntegrationApiError('invalid_input');
    }
    return path;
}

async function responseJson(response) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
        throw new CenterIntegrationApiError('temporarily_unavailable', response.status);
    }
    if (!text) return {};
    try {
        const value = JSON.parse(text);
        if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        return value;
    } catch {
        throw new CenterIntegrationApiError('temporarily_unavailable', response.status);
    }
}

// The browser only calls fixed, first-party routes. The base URL is supplied
// at build/deploy time, never from a query parameter or a user-controlled
// setting, and the current Supabase access token is sent only to that URL.
export async function requestCenterIntegration(path, { method = 'GET', body, signal } = {}) {
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.error || !sessionResult.data?.session?.access_token) {
        throw new CenterIntegrationApiError('unauthenticated', 401);
    }
    const hasBody = body !== undefined;
    let response;
    try {
        response = await fetch(`${centerApiBaseUrl()}${endpointPath(path)}`, {
            method,
            cache: 'no-store',
            credentials: 'omit',
            signal,
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${sessionResult.data.session.access_token}`,
                ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            },
            body: hasBody ? JSON.stringify(body) : undefined,
        });
    } catch (error) {
        if (error instanceof CenterIntegrationApiError) throw error;
        throw new CenterIntegrationApiError('temporarily_unavailable');
    }
    const payload = await responseJson(response);
    if (!response.ok) {
        const code = typeof payload?.error?.code === 'string' && /^[a-z_]{1,80}$/.test(payload.error.code)
            ? payload.error.code
            : 'temporarily_unavailable';
        throw new CenterIntegrationApiError(code, response.status);
    }
    return payload;
}
