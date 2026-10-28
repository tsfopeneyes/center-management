import { isAdminOrStaff } from './userUtils.js';

const pending = new Map();

// Shared by public links and the in-app modal, including anonymous -> login.
export async function trackNoticeView({ noticeId, user, excluded = false, increment, storage = globalThis.sessionStorage }) {
    if (!noticeId || excluded || isAdminOrStaff(user)) return null;
    const key = `viewed_notice_${noticeId}_${user?.id || 'anonymous'}`;
    const anonymousKey = `viewed_notice_${noticeId}_anonymous`;
    const read = key => { try { return storage?.getItem(key); } catch { return null; } };
    const mark = () => { try { storage?.setItem(key, 'true'); } catch { /* Storage can be disabled. */ } };
    if (read(key) || (user?.id && read(anonymousKey))) {
        mark();
        return null;
    }
    // Deduplicate effects in StrictMode and identity changes during a request.
    const requestKey = String(noticeId);
    if (pending.has(requestKey)) {
        const result = await pending.get(requestKey);
        if (result !== null && result !== undefined) mark();
        return result;
    }
    const request = Promise.resolve().then(() => increment(noticeId));
    pending.set(requestKey, request);
    try {
        const result = await request;
        if (result !== null && result !== undefined) mark();
        return result;
    } finally {
        pending.delete(requestKey);
    }
}
