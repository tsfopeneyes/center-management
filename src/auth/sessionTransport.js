// No default URL: never point the staged client at an unprepared live server.
// The future endpoint must verify JWT, live session, protected profile mapping
// and issuance evidence; this transport cannot authorize access by itself.
export function createSessionTransport({endpoint, publishableKey, fetcher = fetch, timeoutMs = 10000}) {
    const url = new URL(endpoint);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
        || !Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) {
        throw new Error('인증 서버에는 HTTPS 연결이 필요합니다.');
    }
    return async (accessToken, {signal} = {}) => {
        const abort = new AbortController();
        const cancel = () => abort.abort();
        signal?.addEventListener('abort', cancel, {once: true});
        if (signal?.aborted) cancel();
        const timer = setTimeout(cancel, timeoutMs);
        try {
            const response = await fetcher(url.href, {
                method: 'POST', signal: abort.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
                headers: {Authorization: `Bearer ${accessToken}`, apikey: publishableKey,
                    'Content-Type': 'application/json'},
                body: JSON.stringify({action: 'session-status', protocol: 1}),
            });
            // 401 and 403 are account decisions. Other failures preserve the session.
            if (response.status === 401) return {protocol: 1, decision: 'reauth'};
            if (response.status === 403) return {protocol: 1, decision: 'blocked'};
            if (!response.ok) throw new Error('인증 서버 연결을 확인하지 못했습니다.');
            return await response.json();
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
        }
    };
}
