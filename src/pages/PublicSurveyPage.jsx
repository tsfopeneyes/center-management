import React, { lazy, Suspense, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, LogIn } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { surveyHubApi } from '../api/surveyHubApi';
import SurveyRunner from '../components/surveys/SurveyRunner';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth/AuthProvider';
import { verifiedSurveyProfile } from '../utils/publicSurveyAuth';

const GuestMobileWelcome = lazy(() => import('./GuestMobileWelcome'));

export default function PublicSurveyPage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const auth = useAuth();
    const [state, setState] = useState({ status: 'loading', link: null, user: null, message: '' });
    const [loginOpen, setLoginOpen] = useState(false);
    const [loginRefresh, setLoginRefresh] = useState(0);

    // Load the public survey definition independently from authentication.
    // Auth token events must never restart this request or replace the screen.
    useEffect(() => {
        let live = true;
        (async () => {
            try {
                const link = await surveyHubApi.publicLink(token);
                if (!live) return;
                if (!link) return setState({ status: 'closed', link: null, user: null, message: '종료되었거나 존재하지 않는 설문입니다.' });
                setState(current => ({ ...current, link }));
            } catch (error) {
                if (live) setState({ status: 'error', link: null, user: null, message: error.message || '설문을 불러오지 못했습니다.' });
            }
        })();
        return () => { live = false; };
    }, [token]);

    // Resolve participation from the current auth snapshot. Initial restoration
    // is allowed to finish silently; it does not toggle an already visible card.
    useEffect(() => {
        const link = state.link;
        if (!link || ['closed', 'error', 'done'].includes(state.status)) return;
        if (['initializing', 'restoring', 'refreshing'].includes(auth.status)) return;

        let live = true;
        (async () => {
            try {
                // AuthProvider verified ownership; the public profile omits auth_user_id.
                const profile = verifiedSurveyProfile(auth);
                if (!profile) {
                    if (live) setState(current => ({ ...current, status: 'login', user: null, message: '' }));
                    return;
                }
                const previous = await supabase.from('survey_entries').select('id').eq('link_id', link.id).eq('user_id', profile.id).eq('response_key', 'ONCE').maybeSingle();
                if (previous.error) throw previous.error;
                if (live) setState(current => ({ ...current, status: previous.data ? 'done' : 'ready', user: profile, message: '' }));
            } catch (error) {
                if (live) setState(current => ({ ...current, status: 'error', message: error.message || '설문을 불러오지 못했습니다.' }));
            }
        })();
        return () => { live = false; };
    }, [state.link?.id, loginRefresh, auth.status, auth.profile?.id, auth.session?.user?.id]);

    const openLogin = () => {
        setLoginOpen(true);
    };

    const finishLogin = () => {
        setLoginOpen(false);
        setState(current => ({ ...current, status: 'loading' }));
        void auth.refresh().finally(() => setLoginRefresh(current => current + 1));
    };

    if (state.status === 'ready') return <main className="min-h-screen bg-[#F6F4F1] px-0 py-0 sm:px-5 sm:py-8"><div className="mx-auto max-w-2xl"><SurveyRunner inline dismissible={false} manageHistory={false} link={state.link} userId={state.user.id} onComplete={() => setState(current => ({ ...current, status: 'done' }))} /></div></main>;
    return <><main className="flex min-h-screen items-center justify-center bg-[#F6F4F1] p-4"><section className="w-full max-w-md overflow-hidden rounded-[30px] border border-black/[0.06] bg-white text-left shadow-[0_18px_55px_rgba(45,35,31,0.09)]"><div className="h-2 bg-haifnRed" /><div className="p-7 sm:p-9"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8E8E4] text-haifnRed">{state.status === 'done' ? <CheckCircle2 size={27} /> : <ClipboardList size={27} />}</div><h1 className="mt-6 text-2xl font-black leading-tight tracking-[-0.025em] text-tossGrey900">{state.link?.version?.definition?.title || '공유 설문'}</h1>{state.status === 'loading' && <p className="mt-3 text-sm font-medium text-tossGrey500">설문을 불러오는 중입니다…</p>}{state.status === 'done' && <><p className="mt-3 text-sm font-medium leading-6 text-tossGrey600">시간을 내어 소중한 의견을 보내줘서 고마워요✨</p><button onClick={() => navigate('/student')} className="mt-7 w-full rounded-2xl bg-haifnRed px-4 py-4 font-bold text-white transition-colors hover:bg-haifnRedHover">확인</button></>}{state.status === 'login' && <><p className="mt-3 text-sm font-medium leading-6 text-tossGrey600">응답자를 확인하기 위해 로그인이 필요해요!</p><button onClick={openLogin} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-haifnRed px-4 py-4 font-bold text-white transition-colors hover:bg-haifnRedHover"><LogIn size={18} />로그인하고 참여하기</button></>}{['closed','error'].includes(state.status) && <><p className="mt-3 text-sm font-medium leading-6 text-tossGrey600">{state.message}</p><button onClick={() => navigate('/')} className="mt-7 w-full rounded-2xl border border-tossGrey200 px-4 py-4 font-bold text-tossGrey700 transition-colors hover:bg-tossGrey50">홈으로 이동</button></>}</div></section></main>{loginOpen && <Suspense fallback={<div className="fixed inset-0 z-50 bg-[#F6F4F1]" aria-hidden="true" />}><GuestMobileWelcome isQRCheckin={false} loginOnly surveyLoginToken={token} onSurveyLoginComplete={finishLogin} onSurveyLoginCancel={() => setLoginOpen(false)} /></Suspense>}</>;
}
