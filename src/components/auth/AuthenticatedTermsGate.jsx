import React, { useState } from 'react';
import TermsConsentModal from './TermsConsentModal';
import { useAuth } from '../../auth/AuthProvider';
import { getAccountAuthClient } from '../../auth/accountAuthRuntime';
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
            await getAccountAuthClient().profile({
                action: 'accept_terms',
                protocol: 1,
                profileId: auth.profile.id,
                termsVersion: TERMS_VERSION,
                agreements,
                source: 'WEB_LOGIN',
            }, { accessToken: auth.session.access_token });
            await auth.refresh();
        } catch (acceptError) {
            console.error('Failed to accept current terms:', acceptError);
            setError('동의 내용을 저장하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');
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
