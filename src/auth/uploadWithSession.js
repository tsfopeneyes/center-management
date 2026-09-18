const loginRequired = () => Object.assign(
    new Error('로그인 상태를 다시 확인해야 합니다. 로그인 후 업로드를 이어가 주세요.'),
    { code: 'reauth_required' }
);

export async function uploadWithSession({ auth, upload, profileId, kind, file }) {
    const current = await auth.getSession();
    const accessToken = current?.data?.session?.access_token;
    if (current?.error || !accessToken) throw loginRequired();

    try {
        return await upload({ profileId, kind, file }, { accessToken });
    } catch (error) {
        if (error?.code !== 'invalid_login') throw error;
    }

    // A 401 cannot have stored the image. Refresh the SDK token once before
    // asking the person to sign in again; never fall back to an anonymous upload.
    const refreshed = await auth.refreshSession();
    const nextToken = refreshed?.data?.session?.access_token;
    if (refreshed?.error || !nextToken) throw loginRequired();
    try {
        return await upload({ profileId, kind, file }, { accessToken: nextToken });
    } catch (error) {
        if (error?.code === 'invalid_login') throw loginRequired();
        throw error;
    }
}
