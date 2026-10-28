import { supabase } from '../supabaseClient';

const localKey = (challengeId, userId) => `challengeSuccessShown:v1:${challengeId}:${userId}`;
const shownThisPage = new Set();
const persistReceipt = async (challengeId, userId) => {
    const { error } = await supabase.from('challenge_success_message_receipts')
        .insert({ challenge_id: challengeId, user_id: userId });
    if (error && error.code !== '23505') throw error;
};
const cached = key => {
    if (shownThisPage.has(key)) return true;
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
};

export const challengeSuccessApi = {
    async hasShown(challengeId, userId) {
        const key = localKey(challengeId, userId);
        if (cached(key)) {
            // Retry persistence after a previous offline display, without showing again.
            void persistReceipt(challengeId, userId).catch(error => console.error('Failed to sync challenge success receipt:', error));
            return true;
        }
        // Direct table access; a receipt is independent of rewards and thresholds.
        const { data, error } = await supabase.from('challenge_success_message_receipts')
            .select('shown_at').eq('challenge_id', challengeId).eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (data) shownThisPage.add(key);
        return Boolean(data);
    },

    async markShown(challengeId, userId) {
        const key = localKey(challengeId, userId);
        // Remember only after the popup has rendered, even if persistence is slow.
        shownThisPage.add(key);
        try { localStorage.setItem(key, '1'); } catch { /* In-memory cache still works. */ }
        await persistReceipt(challengeId, userId);
    },
};
