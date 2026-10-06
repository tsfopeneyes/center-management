import { supabase } from '../supabaseClient';
export const koreanDay = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export async function recordWelcomeQrVisit() {
    if (new URLSearchParams(window.location.search).get('from') !== 'qr') return;
    try {
        const day = koreanDay();
        let token = localStorage.getItem('welcome-qr-browser');
        if (!token || !/^[0-9a-f-]{36}$/.test(token)) { token = crypto.randomUUID(); localStorage.setItem('welcome-qr-browser', token); }
        if (localStorage.getItem('welcome-qr-recorded-day') === day) return;
        const { error } = await supabase.from('welcome_qr_visits').insert({ browser_token: token });
        if (!error || error.code === '23505') localStorage.setItem('welcome-qr-recorded-day', day);
    } catch { /* Analytics must never interrupt the introduction or chat. */ }
}
