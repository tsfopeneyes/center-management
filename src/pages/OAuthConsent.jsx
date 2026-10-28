import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../supabaseClient';
import { requestCenterIntegration } from '../api/centerIntegrationApi';
import GuestMobileWelcome from './GuestMobileWelcome';
import { consentDetails } from '../auth/oauthConsentDetails.mjs';
import { resumeOAuthConsent, consentFailure, consentActorKey } from '../auth/resumeOAuthConsent.mjs';

const authorizationIdPattern = /^[A-Za-z0-9_-]{1,512}$/;

function nativeRedirect(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error();
        return url.href;
    } catch {
        throw new Error('invalid_redirect');
    }
}

export default function OAuthConsent() {
    const auth = useAuth();
    const actorKey = consentActorKey(auth);
    const authorizationId = new URLSearchParams(window.location.search).get('authorization_id');
    const validAuthorizationId = typeof authorizationId === 'string' && authorizationIdPattern.test(authorizationId);
    const [state, setState] = useState(() => validAuthorizationId ? { kind: 'loading', clientName: '' } : { kind: 'invalid', clientName: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let live = true;
        if (!validAuthorizationId) {
            setState({ kind: 'invalid', clientName: '' });
            return () => { live = false; };
        }
        if (!actorKey) {
            setState({ kind: 'loading', clientName: '' });
            return () => { live = false; };
        }
        setState({ kind: 'loading', clientName: '' });
        setError('');
        let stage = 'details';
        void supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(async ({ data, error: detailsError }) => {
            if (!live) return;
            // Existing provider consent can return only redirect_url. Recheck
            // and bind the approved request on our server before returning.
            if (!detailsError && typeof data?.redirect_url === 'string') {
                await resumeOAuthConsent({ authorizationId, redirectUrl: data.redirect_url,
                    request: requestCenterIntegration, isLive: () => live, onStage: value => { stage = value; },
                    navigate: redirect => window.location.assign(redirect) });
                return;
            }
            const details = detailsError ? null : consentDetails(data);
            setState(details ? { kind: 'ready', ...details } : { kind: 'invalid', clientName: '' });
            if (!details) setError(consentFailure(stage, detailsError || new Error('unsupported_request')));
        }).catch(failure => { if (live) { setState({ kind: 'invalid', clientName: '' }); setError(consentFailure(stage, failure)); } });
        return () => { live = false; };
    }, [authorizationId, actorKey, validAuthorizationId]);

    const decide = async approve => {
        if (busy || !validAuthorizationId || !actorKey) return;
        setBusy(true);
        setError('');
        let stage = 'prepare';
        try {
            if (approve) {
                // The server independently checks the current website session,
                // account role, native authorization owner, exact resource,
                // client allow-list, and PKCE before native approval happens.
                const prepared = await requestCenterIntegration('/v1/connections/prepare', {
                    method: 'POST',
                    body: { authorization_id: authorizationId },
                });
                if (typeof prepared?.request_id !== 'string') throw new Error('prepare_failed');
                stage = 'approval';
                const approved = await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true });
                if (approved.error || !approved.data?.redirect_url) throw new Error('approval_failed');
                stage = 'complete';
                const completed = await requestCenterIntegration('/v1/connections/complete', {
                    method: 'POST',
                    body: { request_id: prepared.request_id },
                });
                if (completed?.state !== 'active') throw new Error('completion_failed');
                window.location.assign(nativeRedirect(approved.data.redirect_url));
                return;
            }
            const denied = await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
            if (denied.error || !denied.data?.redirect_url) throw new Error('denial_failed');
            window.location.assign(nativeRedirect(denied.data.redirect_url));
        } catch (failure) {
            setError(approve
                ? consentFailure(stage, failure)
                : '취소를 완료하지 못했습니다. 다시 시도해 주세요.');
            setBusy(false);
        }
    };

    if (auth.status === 'anonymous' && validAuthorizationId && state.kind !== 'invalid') {
        return <GuestMobileWelcome loginOnly isQRCheckin={false} onLoginComplete={() => void auth.refresh()} onLoginCancel={() => window.location.assign('/')} />;
    }

    const waitingForLogin = !actorKey;
    return <main className="min-h-screen bg-[#F8F9FA] px-6 py-12 text-gray-900 sm:py-20">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm sm:p-10" aria-labelledby="consent-title" aria-busy={busy || state.kind === 'loading'}>
            <h1 id="consent-title" className="text-2xl font-bold tracking-tight sm:text-3xl">ChatGPT에 센터 분석 연결</h1>
            <p className="mt-4 leading-7 text-gray-700">현재 로그인한 운영자 계정으로 센터 운영 통계를 ChatGPT에서 조회하도록 연결합니다.</p>

            <ul className="mt-6 space-y-3 border-y border-gray-200 py-6 leading-7">
                <li>방문·이용 시간·프로그램 참여·재방문 같은 집계 통계</li>
                <li>승인된 프로그램의 분석용 목록과 지표 정의</li>
                <li>개인 이름·연락처·개인별 기록·자유 서술 응답은 제공하지 않습니다.</li>
                <li>데이터 수정·삭제, 공지 게시, 메시지 발송 권한은 부여하지 않습니다.</li>
            </ul>

            {state.kind === 'ready' && <p className="mt-5 rounded-xl bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-950"><strong>{state.clientName}</strong>에서 이 연결을 요청했습니다. 서버는 승인할 때에도 현재 운영자 권한과 전용 연결 상태를 다시 확인합니다.</p>}
            <div role="status" className="mt-6 text-sm leading-6">
                {state.kind === 'invalid' ? '연결 요청이 유효하지 않습니다. ChatGPT에서 연결을 다시 시작해 주세요.'
                    : ['offline', 'blocked'].includes(auth.status) ? '로그인을 다시 확인해 주세요.'
                        : waitingForLogin || state.kind === 'loading' ? '로그인과 연결 요청을 확인하고 있습니다…'
                            : '조회 범위를 확인한 후 승인해 주세요.'}
            </div>
            {error && <p role="alert" className="mt-4 text-sm leading-6 text-red-800">{error}</p>}
            {['offline', 'blocked'].includes(auth.status) && <div className="mt-4 text-sm leading-6"><p>로그인을 확인하지 못했습니다. 연결 상태와 계정을 확인한 뒤 다시 시도해 주세요.</p><button type="button" onClick={() => void auth.refresh()} className="mt-2 min-h-12 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#CF3A27]">로그인 다시 확인</button></div>}

            {state.kind !== 'invalid' && <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
                <button type="button" disabled={waitingForLogin || state.kind !== 'ready' || busy} onClick={() => void decide(false)} className="min-h-12 rounded-xl border border-gray-300 px-6 py-3 font-semibold hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#CF3A27] disabled:opacity-50">취소</button>
                <button type="button" disabled={waitingForLogin || state.kind !== 'ready' || busy} onClick={() => void decide(true)} className="min-h-12 flex-1 rounded-xl bg-[#CF3A27] px-6 py-3 font-bold text-white hover:bg-[#B72E1D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#CF3A27] disabled:opacity-50">{busy ? '처리 중…' : '읽기 전용 연결 승인'}</button>
            </div>}
            {state.kind === 'invalid' && <a href="/" className="mt-6 inline-block underline underline-offset-4">센터 홈으로 돌아가기</a>}
        </section>
    </main>;
}
