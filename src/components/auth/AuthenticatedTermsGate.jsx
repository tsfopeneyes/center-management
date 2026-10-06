import React, { useState } from 'react';
import TermsConsentModal from './TermsConsentModal';
import { useAuth } from '../../auth/AuthProvider';
import { getAccountAuthClient } from '../../auth/accountAuthRuntime';
import { supabase } from '../../supabaseClient';
import { TERMS_VERSION } from '../../constants/appConstants';
import { requiresCurrentTermsConsent } from '../../utils/termsConsent';

export default function AuthenticatedTermsGate() {
    const auth = useAuth();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const required = window.location.pathname.toLowerCase() !== '/screen'
        && ['authenticated', 'offline'].includes(auth.status) && requiresCurrentTermsConsent(auth.profile);

    const accept = async agreements => {
        if (saving || !required) return;
        setSaving(true);
        setError('');
        try {
            // A phone may keep this screen open while its access token expires.
            // Ask Supabase for the current session before submitting consent.
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData?.session?.access_token) {
                throw sessionError || Object.assign(new Error('invalid_login'), { code: 'invalid_login' });
            }
            await getAccountAuthClient().profile({
                action: 'accept_terms',
                protocol: 1,
                profileId: auth.profile.id,
                termsVersion: TERMS_VERSION,
                agreements,
                source: 'WEB_LOGIN',
            }, { accessToken: sessionData.session.access_token });
            await auth.refresh();
        } catch (acceptError) {
            console.error('Failed to accept current terms:', acceptError);
            setError(['invalid_login', 'cancelled'].includes(acceptError?.code)
                ? '로그인 시간이 만료되었습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.'
                : '동의 내용을 저장하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');
        } finally {
            setSaving(false);
        }
    };

    return <TermsConsentModal
        isOpen={required}
        onClose={() => {}}
        onAgree={accept}
        required
        saving={saving}
        error={error}
    />;
}
