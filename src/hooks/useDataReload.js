import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

// Retry mount-time reads when session restoration or browser connectivity
// recovers. A failed first read must not leave defaults on screen forever.
export function useDataReload() {
    const auth = useAuth();
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const reload = () => {
            if (document.visibilityState === 'visible') setRevision(value => value + 1);
        };
        const pageshow = event => { if (event.persisted) reload(); };
        window.addEventListener('online', reload);
        window.addEventListener('focus', reload);
        window.addEventListener('pageshow', pageshow);
        document.addEventListener('visibilitychange', reload);
        return () => {
            window.removeEventListener('online', reload);
            window.removeEventListener('focus', reload);
            window.removeEventListener('pageshow', pageshow);
            document.removeEventListener('visibilitychange', reload);
        };
    }, []);
    const verifiedToken = ['authenticated', 'refreshing'].includes(auth.status) ? auth.session?.access_token : '';
    return `${revision}:${verifiedToken || ''}`;
}
