export const verifiedSurveyProfile = auth =>
    auth?.status === 'authenticated' && auth.session?.user?.id && auth.profile?.id
        ? auth.profile
        : null;
