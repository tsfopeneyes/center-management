import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Users } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { communityChannelsApi } from '../api/communityChannelsApi';
import { challengeMissionsApi } from '../api/challengeMissionsApi';
import CommunityModal from '../components/student/modals/CommunityModal';
import { useAuth } from '../auth/AuthProvider';
const GuestMobileWelcome = React.lazy(() => import('./GuestMobileWelcome'));

export default function CommunityChannelPage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const initialPostId = searchParams.get('post');
    const navigate = useNavigate();
    const closeCommunity = () => {
        if (searchParams.get('from') === 'push')
            navigate('/student', { replace: true });
        else navigate(-1);
    };
    const auth = useAuth();
    const user = ['authenticated', 'refreshing'].includes(auth.status) ? auth.profile : null;
    const [preview, setPreview] = useState(null);
    const [channel, setChannel] = useState(null);
    const [notice, setNotice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');
    const [loginOpen, setLoginOpen] = useState(false);
    const [entryFailed, setEntryFailed] = useState(false);
    const enter = useCallback(async () => {
        const resolved = await communityChannelsApi.fetchChannel(id);
        let program = null;
        if (resolved.source_notice_id) {
            program = await communityChannelsApi.fetchChallengeNotice(resolved.source_notice_id);
            if (program.is_challenge && program.challenge_format === 'ONLINE')
                program.challenge_missions = await challengeMissionsApi.fetchMissions(program.id, 'ONLINE');
        }
        setNotice(program);
        setChannel(resolved);
        localStorage.removeItem('pendingCommunityJoin');
    }, [id]);
    useEffect(() => {
        let active = true;
        setChannel(null); setNotice(null); setError(''); setLoading(true); setEntryFailed(false);
        communityChannelsApi.fetchInvitePreview(id).then(value => { if (active) setPreview(value); })
            .catch(() => { if (active) { setPreview(null); setError('운영 예정이거나 종료된 커뮤니티입니다.'); } })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [id]);
    useEffect(() => {
        if (!user?.id || !preview || preview.status !== 'ACTIVE') return;
        let active = true;
        setEntryFailed(false);
        void enter().catch(async () => {
            if (!preview.source_notice_id && localStorage.getItem('pendingCommunityJoin') === id) {
                try { await communityChannelsApi.joinStandaloneChannel(id, user.id); await enter(); }
                catch (failure) { if (active) { setError(failure.message || '참여하지 못했어요. 다시 시도해주세요.'); setEntryFailed(true); } }
            } else if (active) {
                setError('커뮤니티 입장 권한을 확인하지 못했어요. 로그인 상태와 참여 내역을 확인해주세요.');
                setEntryFailed(true);
            }
        });
        return () => { active = false; };
    }, [enter, id, preview, user?.id]);
    const join = async () => {
        if (!user?.id) { localStorage.setItem('pendingCommunityJoin', id); setLoginOpen(true); return; }
        if (joining) return;
        setJoining(true); setError('');
        try {
            // Open programs admit signed-in visitors without creating membership records.
            if (!preview.source_notice_id) await communityChannelsApi.joinStandaloneChannel(id, user.id);
            await enter();
        } catch (failure) {
            setError(preview.source_notice_id && !preview.is_open_program
                ? '프로그램 신청 확정자, 회차 출석자 또는 관리자만 입장할 수 있어요.'
                : failure.message || '커뮤니티에 들어가지 못했어요. 다시 시도해주세요.');
        } finally { setJoining(false); }
    };
    if (channel && user) return <CommunityModal key={channel.id} channel={channel} notice={notice} user={user} initialPostId={initialPostId}
        manageHistory={false} onClose={closeCommunity} />;
    if (loading || ['initializing', 'restoring'].includes(auth.status)
        || (user && preview?.status === 'ACTIVE' && !entryFailed))
        return <main className="flex min-h-screen items-center justify-center bg-[#F7EFE2] p-4"><p role="status" className="text-sm font-bold text-[#71665C]">커뮤니티를 여는 중...</p></main>;
    return <main className="flex min-h-screen items-center justify-center bg-[#F7EFE2] p-4">
        <section className="w-full max-w-lg rounded-2xl border border-[#E7D8C4] bg-[#FFFDF9] p-6">
            <button type="button" onClick={closeCommunity} aria-label="뒤로 가기" className="mb-5 rounded-full p-2 text-[#71665C] hover:bg-[#FBF3E7]"><ArrowLeft size={21}/></button>
            <h1 className="text-2xl font-black text-[#302A25]">{preview?.name || '커뮤니티'}</h1>
            {preview?.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#71665C]">{preview.description}</p>}
            <p className="mt-4 text-sm text-[#71665C]">{preview?.is_open_program ? '로그인하면 누구나 바로 들어가 글과 사진을 남길 수 있어요.' : preview?.source_notice_id ? '프로그램 신청·참여 내역을 확인한 뒤 입장할 수 있는 커뮤니티입니다.' : '참여하면 글과 사진을 함께 나눌 수 있어요.'}</p>
            {!preview?.is_open_program && preview && <p className="mt-3 flex items-center gap-1 text-xs text-[#71665C]"><Users size={14}/>{Number(preview.participant_count)}명 참여 중</p>}
            {preview?.status === 'SCHEDULED' && <p className="mt-4 text-sm text-[#71665C]">프로그램 모집이 시작되면 커뮤니티가 자동으로 열려요.</p>}
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button type="button" onClick={join} disabled={loading || !preview || preview.status !== 'ACTIVE' || joining}
                className="mt-6 h-12 w-full rounded-xl bg-[#CF3A27] font-bold text-white hover:bg-[#B93223] disabled:opacity-40">{loading ? '불러오는 중...' : joining ? '입장 확인 중...' : preview?.is_open_program ? '커뮤니티 입장' : preview?.source_notice_id ? '참여 확인하기' : '참여하기'}</button>
        </section>
        {loginOpen && <React.Suspense fallback={<div className="fixed inset-0 bg-black/40"/>}><GuestMobileWelcome
            isQRCheckin={false} loginOnly communityLoginId={id}
            onCommunityLoginComplete={() => { setLoginOpen(false); void auth.refresh(); }}
            onCommunityLoginCancel={() => setLoginOpen(false)}/></React.Suspense>}
    </main>;
}
