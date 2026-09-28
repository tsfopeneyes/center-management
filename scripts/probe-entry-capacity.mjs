import 'dotenv/config';

const requests = 40;
const targets = [
    ['hosting', 'https://sci-center-6f265.web.app/'],
    ['database', `${process.env.VITE_SUPABASE_URL}/rest/v1/locations?select=id&limit=1`],
    ['auth', `${process.env.VITE_SUPABASE_URL}/auth/v1/settings`],
    ['account-auth', `${process.env.VITE_ACCOUNT_AUTH_BASE_URL}/health`],
];

const samples = await Promise.all(targets.map(async ([name, url]) => {
    const results = await Promise.all(Array.from({ length: requests }, async () => {
        const started = performance.now();
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(15000),
                headers: ['database', 'auth'].includes(name) ? { apikey: process.env.VITE_SUPABASE_ANON_KEY } : {},
            });
            await response.arrayBuffer();
            return { status: response.status, ms: Math.round(performance.now() - started) };
        } catch (error) {
            return { status: error.name || 'network_error', ms: Math.round(performance.now() - started) };
        }
    }));
    const counts = Object.fromEntries([...new Set(results.map(item => item.status))].map(status =>
        [status, results.filter(item => item.status === status).length]));
    const times = results.map(item => item.ms).sort((a, b) => a - b);
    return `${name}: ${JSON.stringify(counts)}, p95=${times[Math.ceil(requests * 0.95) - 1]}ms, max=${times.at(-1)}ms`;
}));
for (const sample of samples) console.log(sample);
