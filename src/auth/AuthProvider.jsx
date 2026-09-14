import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getAccountAuthClient, isAccountAuthEnabled } from './accountAuthRuntime';

const AuthContext = createContext(null);

const readCachedProfile = () => {
    try {
        const value = localStorage.getItem('user') || localStorage.getItem('admin_user');
        const profile = value ? JSON.parse(value) : null;
        return profile?.id ? profile : null;
    } catch {
        return null;
    }
};

const cacheProfile = profile => {
    if (!profile?.id) return;
    try {
        localStorage.setItem('user', JSON.stringify(profile));
    } catch {
        // A full browser storage area must not invalidate a live Auth session.
    }
};

// Supabase persists the complete session as JSON. Reading it synchronously on
// boot avoids making the whole application wait on the SDK's cross-tab lock.
// The value is never trusted for authorization: resolve() still verifies the
// access token with the account service before protected screens are enabled.
const readPersistedSession = () => {
    try {
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
            const value = JSON.parse(localStorage.getItem(key));
            const session = value?.currentSession || value;
            if (session?.access_token && session?.refresh_token && session?.user?.id) return session;
        }
    } catch {
        // Corrupt browser storage is treated as signed out, not as a boot lock.
    }
    return null;
};

const profileMatchesSession = (profile, session) => Boolean(
    profile?.id && session?.user?.id
    && (profile.id === session.user.id || profile.auth_user_id === session.user.id)
);

export function AuthProvider({ children }) {
    const [state, setState] = useState(() => {
        const session = readPersistedSession();
        const profile = readCachedProfile();
        const resumable = profileMatchesSession(profile, session);
        return {
            // A previously verified profile and its provider session restore the
            // last screen synchronously. resolve() revalidates in background;
            // protected reads/writes remain enforced by the server and RLS.
            status: resumable ? 'restoring' : 'initializing',
            session,
            profile,
            error: null,
        };
    });
    const revision = useRef(0);

    const resolve = useCallback(async (session, reason = 'refresh') => {
        const run = ++revision.current;
        const cached = readCachedProfile();

        if (!session?.user?.id || !session.access_token) {
            if (run === revision.current) {
                setState({ status: 'anonymous', session: null, profile: null, error: null });
            }
            return;
        }

        setState(current => ({
            status: ['authenticated', 'restoring', 'refreshing'].includes(current.status)
                ? 'refreshing'
                : 'initializing',
            session,
            profile: current.profile || cached,
            error: null,
        }));

        try {
            if (!isAccountAuthEnabled()) throw Object.assign(new Error('auth_service_disabled'), { transient: true });
            const client = getAccountAuthClient();
            const verified = await client.session(session.access_token, {});
            if (verified?.protocol !== 1 || verified?.decision !== 'retain' || !verified.profileId) {
                const code = verified?.decision === 'blocked' ? 'forbidden' : 'invalid_login';
                throw Object.assign(new Error(code), { code });
            }
            const result = await client.profile(
                { action: 'read', protocol: 1, profileId: verified.profileId },
                { accessToken: session.access_token }
            );
            if (run !== revision.current) return;
            if (result?.protocol !== 1 || result?.status !== 'ok' || !result.profile?.id) {
                throw new Error('invalid_profile_response');
            }
            const profile = cached?.id === result.profile.id ? { ...cached, ...result.profile } : result.profile;
            cacheProfile(profile);
            setState({ status: 'authenticated', session, profile, error: null });
        } catch (error) {
            if (run !== revision.current) return;
            const code = error?.code || error?.message || 'temporarily_unavailable';
            const blocked = ['forbidden', 'account_changed', 'password_change_required'].includes(code);
            // A transient revalidation failure cannot revoke a session that was
            // already verified during this runtime. Access control still lives
            // on the server/RLS, while the current screen remains usable.
            setState(current => {
                const retainVerified = !blocked
                    && current.status === 'refreshing'
                    && profileMatchesSession(current.profile, session);
                return {
                    status: retainVerified ? 'authenticated' : (blocked ? 'blocked' : 'offline'),
                    session,
                    profile: current.profile || cached,
                    error: code,
                };
            });
        }
    }, []);

    const refresh = useCallback(async () => {
        const persisted = readPersistedSession();
        if (persisted) {
            await resolve(persisted, 'manual-persisted');
            return;
        }
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            setState(current => ({
                ...current,
                status: current.status === 'authenticated' || current.status === 'refreshing'
                    ? 'authenticated'
                    : (current.session ? 'offline' : 'anonymous'),
                error: error.code || error.message,
            }));
            return;
        }
        await resolve(data?.session || null, 'manual');
    }, [resolve]);

    useEffect(() => {
        let active = true;
        let subscription = null;
        const persisted = readPersistedSession();
        const persistedAccessToken = persisted?.access_token || null;

        // If durable storage yielded a session, validate it immediately. When
        // it did not, stay in `initializing` until Supabase emits
        // INITIAL_SESSION. Resolving a null value here used to publish
        // `anonymous` just before the SDK restored its session, briefly
        // exposing the login screen to an already signed-in user.
        if (persisted) void resolve(persisted, 'initial-persisted');
        subscription = supabase.auth.onAuthStateChange((event, session) => {
            if (!active) return;
            // We already started boot validation from durable storage above.
            // Supabase emits INITIAL_SESSION while it initializes; allowing a
            // duplicate (or temporarily null) event to resolve here increments
            // the revision and can discard the valid boot result. Only replace
            // the boot candidate when the SDK actually found a different one.
            if (event === 'INITIAL_SESSION'
                && persistedAccessToken
                && (!session?.access_token || session.access_token === persistedAccessToken)) {
                return;
            }
            // Auth callbacks must return before account-service I/O starts.
            window.setTimeout(() => { if (active) void resolve(session, event); }, 0);
        }).data.subscription;
        window.addEventListener('online', refresh);
        return () => {
            active = false;
            revision.current += 1;
            subscription?.unsubscribe();
            window.removeEventListener('online', refresh);
        };
    }, [refresh, resolve]);

    const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const value = useContext(AuthContext);
    if (!value) throw new Error('AuthProvider가 필요합니다.');
    return value;
}
