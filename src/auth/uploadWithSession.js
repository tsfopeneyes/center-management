const loginRequired = () => Object.assign(
    new Error('로그인 상태를 다시 확인해야 합니다. 로그인 후 업로드를 이어가 주세요.'),
    { code: 'reauth_required' }
);

export async function uploadWithSession({ auth, upload, verifySession, profileId, kind, file, sessionToken }) {
    const current = sessionToken === undefined ? await auth.getSession() : null;
    const accessToken = sessionToken === undefined ? current?.data?.session?.access_token : sessionToken;
    if (current?.error || !accessToken) throw loginRequired();

    try {
        return await upload({ profileId, kind, file }, { accessToken });
    } catch (error) {
        if (error?.code !== 'invalid_login') throw error;
    }
    // The upload response alone cannot tell an expired login from an upload
    // authorization bug. Check the same token read-only before showing login.
    let decision;
    try { decision = await verifySession(accessToken); }
    catch { throw new Error('이미지 업로드 서버의 로그인 확인이 지연되고 있습니다. 잠시 후 다시 시도해주세요.'); }
    if (decision?.decision === 'reauth') throw loginRequired();
    if (decision?.decision === 'blocked') throw new Error('계정 권한을 확인할 수 없습니다. 관리자에게 문의해주세요.');
    throw new Error('로그인은 유지 중이지만 이미지 업로드 인증에 실패했습니다. 잠시 후 다시 시도해주세요.');
}
