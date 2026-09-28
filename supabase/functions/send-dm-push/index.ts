import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleAuth } from 'npm:google-auth-library@9';
import webpush from 'npm:web-push@3.6.7';
import { deliverDirectMessagePush } from '../send-recruitment-alerts/dm-push-worker.mjs';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
});
const equal = (a: string, b: string) => {
    let diff = a.length ^ b.length;
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
    }
    return diff === 0;
};

Deno.serve(async request => {
    const secret = Deno.env.get('RECRUITMENT_ALERTS_CRON_SECRET') || '';
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    if (secret.length < 32 || !equal(request.headers.get('Authorization') || '', `Bearer ${secret}`)) {
        return json({ error: 'unauthorized' }, 401);
    }
    if (Deno.env.get('RECRUITMENT_ALERTS_ENABLED') !== 'true') return json({ error: 'disabled' }, 503);

    try {
        const origin = Deno.env.get('RECRUITMENT_APP_ORIGIN') || '';
        const parsed = new URL(origin);
        if (parsed.protocol !== 'https:' || parsed.origin !== origin) throw new Error('origin');
        const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        let firebaseAccess: Promise<{ projectId: string, access: string }> | undefined;
        const getFirebaseAccess = async () => {
            firebaseAccess ??= (async () => {
                const credentials = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
                if (!credentials.project_id) throw new Error('firebase_auth_unavailable');
                const access = await new GoogleAuth({
                    credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
                }).getAccessToken();
                if (!access) throw new Error('firebase_auth_unavailable');
                return { projectId: credentials.project_id, access };
            })();
            return firebaseAccess;
        };
        const dm = await deliverDirectMessagePush({ db, webpush, origin, getFirebaseAccess });
        return json({ dm });
    } catch {
        return json({ error: 'worker_failed' }, 500);
    }
});
