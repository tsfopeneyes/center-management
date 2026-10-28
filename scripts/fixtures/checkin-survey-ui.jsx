
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import StudentCheckinSurveyModal from '../../src/components/student/modals/StudentCheckinSurveyModal';
import { surveyHubApi } from '../../src/api/surveyHubApi';
if (!import.meta.env.DEV) throw new Error('Local only');
let scenario = 'NORMAL', queries = 0;
const definition = { title: '체크인 설문 테스트', questions: [{ id: 'purpose', title: '오늘 무엇을 하고 싶나요?', type: 'choice', options: ['휴식', '대화'], required: true }] };
surveyHubApi.resolve = async () => {
    queries++;
    await new Promise(resolve => setTimeout(resolve, 500));
    if (scenario === 'NONE') return null;
    if (scenario === 'ERROR') throw new Error('Fixture load failure');
    return { id:'test-link', form_id:'test-form', event:'CHECKIN', version:{ id:'test-version', definition } };
};
surveyHubApi.submit = async () => ({ id: 'test-answer' });
const confetti = () => {};
function Demo() {
    const [user, setUser] = useState({ id:'fixture-user', name:'테스트' });
    const [location, setLocation] = useState({ state: null });
    const [showCheckinSurveyModal, setShowCheckinSurveyModal] = useState(false);
    const [checkinLocationName, setCheckinLocationName] = useState('하이픈');
    const [checkinToastMsg, setCheckinToastMsg] = useState(null);
    const checkinSurveyVisitRef = React.useRef(null);
    const begin = mode => {
        scenario = mode; queries = 0;
        const checkinTime = new Date().toISOString();
        sessionStorage.setItem('active_checkin_time', checkinTime);
        sessionStorage.setItem('require_checkin_survey', 'true');
        sessionStorage.removeItem('pending_checkin_notif');
        const checkinSurvey = mode === 'HANDOFF' ? { id:'test-form', config:{ _surveyLink:{ id:'test-link', form_id:'test-form', event:'CHECKIN', version:{ id:'test-version', definition } } } } : undefined;
        setLocation({ state:{ requireCheckinSurvey:true, checkinTime, locationName:'하이픈', checkinSurvey } });
    };
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        const storedToast = sessionStorage.getItem('checkin_toast');
        const isFromToastOnly = location.state?.checkinToastOnly;
        const isForceRequireSurvey = location.state?.requireCheckinSurvey || sessionStorage.getItem('require_checkin_survey') === 'true';

        // Survey modal is strictly for QR Check-in flow! Normal web logins do not trigger survey modal.
        if (!isForceRequireSurvey) {
            return;
        }

        const checkTodayCheckin = async () => {
            const now = new Date();
            const kstDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (9 * 60 * 60 * 1000));
            const y = kstDate.getFullYear();
            const m = String(kstDate.getMonth() + 1).padStart(2, '0');
            const d = String(kstDate.getDate()).padStart(2, '0');
            const todayKst = `${y}-${m}-${d}`;
            const startOfTodayIso = `${todayKst}T00:00:00+09:00`;

            try {
                const handedOffCheckinTime = location.state?.checkinTime || sessionStorage.getItem('active_checkin_time');
                const { data: todayLogs } = handedOffCheckinTime ? { data: [{ created_at: handedOffCheckinTime }] } : await supabase
                    .from('logs')
                    .select('id, created_at')
                    .eq('user_id', user.id)
                    .eq('type', 'CHECKIN')
                    .gte('created_at', startOfTodayIso)
                    .order('created_at', { ascending: false })
                    .limit(1);

                const latestCheckinTime = todayLogs?.[0]?.created_at || sessionStorage.getItem('active_checkin_time');
                if (cancelled) return;
                // History changes and profile refreshes can rerun this effect.
                // A QR visit owns exactly one survey opening, even while it loads.
                if (checkinSurveyVisitRef.current === latestCheckinTime && latestCheckinTime) return;
                checkinSurveyVisitRef.current = latestCheckinTime;

                const userName = location.state?.userName || user?.name || '';
                const locName = location.state?.locationName || '하이픈';
                setCheckinLocationName(locName);

                const isDismissed = latestCheckinTime ? sessionStorage.getItem(`survey_dismissed_${latestCheckinTime}`) : null;
                if (!isDismissed) {
                    sessionStorage.removeItem('checkin_toast');
                    setShowCheckinSurveyModal(true);
                } else if (storedToast || isFromToastOnly) {
                    sessionStorage.removeItem('checkin_toast');
                    setCheckinToastMsg({
                        title: `${userName ? userName + '님, ' : ''}${locName} 체크인 완료!`,
                        sub: '오늘 하루도 SCI 센터에서 즐거운 시간 보내세요 ✨'
                    });
                    setTimeout(() => setCheckinToastMsg(null), 6000);
                }
            } catch (err) {
                console.error('Failed to verify today checkin survey status:', err);
            }
        };

        checkTodayCheckin();
        return () => { cancelled = true; };
    }, [location.state, user?.id, user?.name]);
    return <main className="p-6"><h1>실제 체크인 설문 코드 검증 · 실제 저장 없음</h1>
        <button onClick={() => begin('NORMAL')}>정상 체크인</button>{' '}
        <button onClick={() => begin('HANDOFF')}>QR 설문 전달</button>{' '}
        <button onClick={() => begin('NONE')}>설문 없는 체크인</button>{' '}
        <button onClick={() => begin('ERROR')}>조회 실패 체크인</button>{' '}
        <button onClick={() => setUser(current => ({ ...current, name:current.name+'!' }))}>프로필 갱신</button>{' '}
        <button onClick={() => setLocation(current => ({ ...current, state:{...current.state} }))}>화면 상태 갱신</button>
        <p>설문 조회 횟수: {queries}</p><p>설문 상태: {showCheckinSurveyModal ? '열림' : '닫힘'}</p>
        {checkinToastMsg && <p>{checkinToastMsg.title}</p>}
        <StudentCheckinSurveyModal isOpen={showCheckinSurveyModal} user={user} locationName={checkinLocationName} initialSurvey={location.state?.checkinSurvey} onClose={(didComplete) => {
                    setShowCheckinSurveyModal(false);
                    sessionStorage.removeItem('require_checkin_survey');
                    sessionStorage.removeItem('pending_checkin_survey');
                    const checkinTime = checkinSurveyVisitRef.current || sessionStorage.getItem('active_checkin_time');
                    if (checkinTime) sessionStorage.setItem(`survey_dismissed_${checkinTime}`, 'true');

                    setCheckinToastMsg({
                        title: `${user?.name ? user.name + '님, ' : ''}${checkinLocationName || '하이픈'} 체크인 완료!`,
                        sub: '오늘 하루도 SCI 센터에서 즐거운 시간 보내세요 ✨'
                    });
                    if (didComplete) {
                        try {
                            confetti({
                                particleCount: 120,
                                spread: 70,
                                origin: { y: 0.3 }
                            });
                        } catch (e) {}
                    }
                    setTimeout(() => {
                        setCheckinToastMsg(null);
                    }, 6000);
                }} />
    </main>;
}
createRoot(document.getElementById('root')).render(<Demo />);
