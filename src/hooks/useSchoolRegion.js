import { useEffect, useRef, useCallback, useState } from 'react';
import { resolveSchoolRegion } from '../utils/schoolRegionUtils';
import { normalizeSchoolName } from '../utils/schoolUtils';
import { subscribeDataRefresh } from '../utils/dataRefresh';

const RETRY_DELAYS = [1000, 3000, 8000];

export function useSchoolRegion(schoolName, { resolve = resolveSchoolRegion, retryDelays = RETRY_DELAYS } = {}) {
    const schoolKey = normalizeSchoolName(schoolName);
    const [state, setState] = useState({ schoolKey: '', region: null, status: 'idle', checkedAt: null, attempts: 0 });
    const runRef = useRef(null);
    const retry = useCallback(() => runRef.current?.(true, true) || Promise.resolve(null), []);
    useEffect(() => {
        let cancelled = false;
        let timer;
        let active = null;
        let attempts = 0;
        const run = (forceRefresh = false, reset = false) => {
            if (active) return active;
            clearTimeout(timer);
            if (reset) attempts = 0;
            if (!schoolName) {
                setState({ schoolKey, region: null, status: 'idle', checkedAt: null, attempts: 0 });
                return Promise.resolve(null);
            }
            attempts += 1;
            setState(previous => ({
                schoolKey,
                region: previous.schoolKey === schoolKey ? previous.region : null,
                checkedAt: previous.schoolKey === schoolKey ? previous.checkedAt : null,
                status: 'loading', attempts,
            }));
            active = Promise.resolve().then(() => resolve(schoolName, { forceRefresh })).then(region => {
                if (!cancelled) setState({ schoolKey, region, status: region ? 'ready' : 'unknown', checkedAt: Date.now(), attempts });
                return region;
            }).catch(() => {
                if (!cancelled) {
                    setState(previous => ({ ...previous, status: 'error', attempts }));
                    if (attempts <= retryDelays.length) timer = setTimeout(() => run(true), retryDelays[attempts - 1]);
                }
                return null;
            }).finally(() => { active = null; });
            return active;
        };
        runRef.current = run;
        run();
        const visible = () => { if (document.visibilityState === 'visible') run(true, true); };
        const online = () => run(true, true);
        const unsubscribe = subscribeDataRefresh(() => run(true, true));
        window.addEventListener('focus', visible);
        window.addEventListener('online', online);
        document.addEventListener('visibilitychange', visible);
        return () => {
            cancelled = true;
            clearTimeout(timer);
            runRef.current = null;
            unsubscribe();
            window.removeEventListener('focus', visible);
            window.removeEventListener('online', online);
            document.removeEventListener('visibilitychange', visible);
        };
    }, [schoolName, schoolKey, resolve, retryDelays]);
    return {
        ...(state.schoolKey === schoolKey ? state : { schoolKey, region: null, status: schoolName ? 'loading' : 'idle', checkedAt: null, attempts: 0 }),
        retry,
    };
}
