import { TERMS_VERSION } from '../constants/appConstants.js';

export const isTemporaryProfile = profile => Boolean(
    profile?.preferences?.is_temporary === true
    || ['게스트', '미가입'].includes(profile?.user_group)
);

export const getTermsConsentStatus = profile => {
    if (!profile?.id || profile?.status === 'withdrawn') return 'UNAVAILABLE';
    if (isTemporaryProfile(profile)) return 'NOT_APPLICABLE';
    if (profile.preferences?.terms_agreed === true
        && profile.preferences?.terms_version === TERMS_VERSION) return 'CURRENT';
    if (profile.preferences?.terms_agreed === true) return 'OUTDATED';
    return 'REQUIRED';
};

export const requiresCurrentTermsConsent = profile => (
    ['REQUIRED', 'OUTDATED'].includes(getTermsConsentStatus(profile))
);
