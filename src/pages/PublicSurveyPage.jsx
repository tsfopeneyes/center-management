import React, { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, LogIn } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { surveyHubApi } from '../api/surveyHubApi';
import SurveyRunner from '../components/surveys/SurveyRunner';
import { supabase } from '../supabaseClient';

const cachedProfile = () => {
    try { const value = localStorage.getItem('user') || localStorage.getItem('admin_user'); return value ? JSON.parse(value) : null; }
    catch { return null; }
};

export default function PublicSurveyPage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [state, setState] = useState({ status: 'loading', link: null, user: null, message: '' });
    useEffect(() => {
        let live = true;
        (async () => {
            try {
                const link = await surveyHubApi.publicLink(token);
                if (!live) return;
                if (!link) return setState({ status: 'closed', link: null, user: null, message: '종료되었거나 존재하지 않는 설문입니다.' });
                const session = (await supabase.auth.getSession()).data?.session;
                const profile = cachedProfile();
                if (!session?.user?.id || !profile?.id || ![profile.id, profile.auth_user_id].includes(session.user.id)) return setState({ status: 'login', link, user: null, message: '' });
                const previous = await supabase.from('survey_entries').select('id').eq('link_id', link.id).eq('user_id', profile.id).eq('response_key', 'ONCE').maybeSingle();
                if (previous.error) throw previous.error;
                setState({ status: previous.data ? 'done' : 'ready', link, user: profile, message: '' });
            } catch (error) {
                if (live) setState({ status: 'error', link: null, user: null, message: error.message || '설문을 불러오지 못했습니다.' });
            }
        })();
        return () => { live = false; };
    }, [token]);

    if (state.status === 'ready') return <main className="min-h-screen bg-[#f7f8fa] px-4 py-8"><div className="mx-auto max-w-xl"><SurveyRunner inline manageHistory={false} link={state.link} userId={state.user.id} onClose={() => navigate('/student')} onComplete={() => setState(current => ({ ...current, status: 'done' }))} /></div></main>;
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-4"><section className="w-full max-w-md rounded-[28px] border border-gray-100 bg-white p-7 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">{state.status === 'done' ? <CheckCircle2 size={28} /> : <ClipboardList size={28} />}</div><h1 className="mt-5 text-xl font-black text-gray-900">{state.link?.version?.definition?.title || '공유 설문'}</h1>{state.status === 'loading' && <p className="mt-3 text-sm text-gray-500">설문을 불러오는 중입니다…</p>}{state.status === 'done' && <><p className="mt-3 text-sm text-gray-600">응답이 제출되었습니다. 참여해 주셔서 감사합니다.</p><button onClick={() => navigate('/student')} className="mt-6 w-full rounded-xl bg-gray-900 px-4 py-3 font-bold text-white">학생 화면으로 돌아가기</button></>}{state.status === 'login' && <><p className="mt-3 text-sm leading-6 text-gray-600">응답자를 확인하기 위해 로그인이 필요합니다. 로그인 후 이 설문으로 다시 돌아옵니다.</p><button onClick={() => navigate(`/?surveyLogin=${encodeURIComponent(token)}`)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"><LogIn size={17} />로그인하고 참여하기</button></>}{['closed','error'].includes(state.status) && <><p className="mt-3 text-sm text-gray-600">{state.message}</p><button onClick={() => navigate('/')} className="mt-6 w-full rounded-xl border border-gray-200 px-4 py-3 font-bold text-gray-700">홈으로 이동</button></>}</section></main>;
}
