import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';

const env = dotenv.parse(readFileSync('.env'));
const url = `${env.VITE_SUPABASE_URL}/functions/v1/haifn-chat`;
const headers = { 'content-type': 'application/json', apikey: env.VITE_SUPABASE_ANON_KEY };
const token = randomBytes(32).toString('hex');

const history = await fetch(url, {
    method: 'POST', headers, body: JSON.stringify({ action: 'history', token }),
    signal: AbortSignal.timeout(15000),
});
const result = await history.json();
if (history.status !== 200 || !Array.isArray(result.messages) || result.messages.length !== 0) {
    throw new Error(`New visitor history check failed: HTTP ${history.status}`);
}

const invalid = await fetch(url, {
    method: 'POST', headers, body: JSON.stringify({ action: 'send', token, body: '' }),
    signal: AbortSignal.timeout(15000),
});
if (invalid.status !== 400) throw new Error(`Empty message was accepted: HTTP ${invalid.status}`);

console.log('HAIFN live chat checks passed: new history is empty, invalid message rejected.');
