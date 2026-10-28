// A verified identity stays the same while AuthProvider revalidates its session.
// Losing that identity still cancels the flow; refreshing it must not replay a
// single-use native authorization request.
export function consentActorKey(auth) {
    return ['authenticated', 'refreshing'].includes(auth?.status) && auth?.session?.user?.id && auth?.profile?.id
        ? `${auth.session.user.id}:${auth.profile.id}` : '';
}

export async function resumeOAuthConsent({ authorizationId, redirectUrl, request, isLive, navigate, onStage = () => {} }) {
    onStage('redirect');
    const url = new URL(redirectUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('invalid_redirect');
    onStage('prepare');
    const prepared = await request('/v1/connections/prepare', {
        method: 'POST', body: { authorization_id: authorizationId },
    });
    if (!isLive()) return;
    if (typeof prepared?.request_id !== 'string') throw new Error('prepare_failed');
    onStage('complete');
    const completed = await request('/v1/connections/complete', {
        method: 'POST', body: { request_id: prepared.request_id },
    });
    if (!isLive()) return;
    if (completed?.state !== 'active') throw new Error('completion_failed');
    navigate(url.href);
}

// Display only bounded codes, never provider messages, callback URLs or tokens.
export function consentFailure(stage, error) {
    const stages = { details: '요청 확인', redirect: '복귀 주소 확인', prepare: '연결 준비', complete: '연결 활성화', approval: '승인' };
    const candidate = error?.code || error?.message;
    const code = typeof candidate === 'string' && /^[a-z_]{1,80}$/.test(candidate) ? candidate : 'unknown_error';
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? ` / ${error.status}` : '';
    return `${stages[stage] || stages.details} 단계에서 실패했습니다. 오류 코드: ${code}${status}`;
}
