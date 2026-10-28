export function createConsentHandler({ prepare, origin }) {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': origin, Vary: 'Origin',
        'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
    const json = (body, status) => Response.json(body, { status, headers });
    return async request => {
        if (request.headers.get('Origin') !== origin) return json({ error: 'forbidden' }, 403);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
        if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
        if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return json({ error: 'unsupported_media_type' }, 415);
        const bearer = request.headers.get('Authorization') || '';
        if (!/^Bearer [A-Za-z0-9._-]+$/.test(bearer) || bearer.length > 8200) return json({ error: 'unauthorized' }, 401);
        let body;
        try {
            const reader = request.body?.getReader(); if (!reader) throw new Error();
            const chunks = []; let size = 0;
            for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length;
                if (size > 1024) { await reader.cancel(); return json({ error: 'request_too_large' }, 413); } chunks.push(part.value); }
            const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
            body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
            if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.authorizationId !== 'string') throw new Error();
        } catch { return json({ error: 'invalid_request' }, 400); }
        if (typeof prepare !== 'function') return json({ error: 'not_configured' }, 503);
        try { return json(await prepare({ authorizationId: body.authorizationId, accessToken: bearer.slice(7) }), 200); }
        catch (error) { return json({ error: 'connection_not_allowed' }, ['forbidden','invalid_login'].includes(error?.code) ? 403 : 503); }
    };
}
