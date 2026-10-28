import { useEffect, useRef, useState } from 'react';
import { challengeSuccessApi } from '../api/challengeSuccessApi';

export default function useChallengeSuccessMessage({ challengeId, userId, ready, eligible, isSuccess, autoEnabled = true, onCelebrate }) {
    const [openKey, setOpenKey] = useState(null);
    const key = `${challengeId}:${userId}`;
    const open = openKey === key && ready && eligible && isSuccess;
    const checkedKey = useRef(null);
    const onCelebrateRef = useRef(onCelebrate);
    onCelebrateRef.current = onCelebrate;

    useEffect(() => { setOpenKey(null); }, [key]);
    useEffect(() => { if (!ready || !eligible || !isSuccess) setOpenKey(null); }, [ready, eligible, isSuccess]);

    useEffect(() => {
        if (!autoEnabled || !ready || !eligible || !isSuccess || !challengeId || !userId) return;
        if (checkedKey.current === key) return;
        let active = true;
        challengeSuccessApi.hasShown(challengeId, userId).then(shown => {
            if (!active) return;
            checkedKey.current = key;
            if (!shown) { setOpenKey(key); onCelebrateRef.current?.(); }
        }).catch(error => console.error('Failed to read challenge success receipt:', error));
        return () => { active = false; };
    }, [key, challengeId, userId, ready, eligible, isSuccess, autoEnabled]);

    useEffect(() => {
        if (!open) return;
        // This effect runs after the visible popup commits, not during prefetch.
        void challengeSuccessApi.markShown(challengeId, userId)
            .catch(error => console.error('Failed to save challenge success receipt:', error));
    }, [open, challengeId, userId]);

    const show = () => { if (ready && eligible && isSuccess) setOpenKey(key); };
    const close = () => setOpenKey(null);
    return { open, show, close };
}
