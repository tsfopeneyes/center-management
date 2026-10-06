import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const input = await request.json();
    const token = String(input.token || '');
    if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: 'Invalid session token' }, 400);
    const action = String(input.action || '');
    if (action !== 'send' && action !== 'history') return json({ error: 'Unknown action' }, 400);
    const body = action === 'send' ? String(input.body || '').trim() : '';
    if (action === 'send' && (body.length < 1 || body.length > 1000)) {
      return json({ error: 'Message length must be 1–1000' }, 400);
    }
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    const tokenHash = await hash(token);
    let { data: session, error: sessionError } = await db.from('haifn_chat_sessions')
      .select('id').eq('token_hash', tokenHash).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session && action === 'history') return json({ messages: [] });
    if (!session && action === 'send') {
      const created = await db.from('haifn_chat_sessions').insert({ token_hash: tokenHash })
        .select('id').single();
      if (created.error) throw created.error;
      session = created.data;
    }
    if (!session) return json({ error: 'Session not found' }, 404);
    if (action === 'send') {
      const inserted = await db.from('haifn_chat_messages').insert({ session_id: session.id, sender: 'VISITOR', body });
      if (inserted.error) throw inserted.error;
    }
    const history = await db.from('haifn_chat_messages').select('id,sender,body,created_at')
      .eq('session_id', session.id).order('created_at', { ascending: true }).limit(200);
    if (history.error) throw history.error;
    return json({ messages: history.data });
  } catch (error) {
    console.error('haifn-chat error', error);
    return json({ error: 'Chat is unavailable' }, 503);
  }
});
