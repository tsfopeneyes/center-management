import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { surveyHubApi } from '../../api/surveyHubApi';
import SurveyRunner from './SurveyRunner';
import { programSurveyEndAt } from '../../utils/surveyModel';
import useModalClose from '../../hooks/useModalClose';

export default function ProgramSurveyGate({ program, onClose, onSuccess, legacy }) {
    const [state, setState] = useState({ loading: true });
    useModalClose(true, onClose);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                if (program.guest_properties?.survey_version_id === '' && program.guest_properties?.enable_feedback === true) { if (active) setState({ legacy: true }); return; }
                const link = await surveyHubApi.resolve({ noticeId: program.id, userId: user.id });
                if (link === undefined) { if (active) setState({ legacy: true }); return; }
                if (!link) throw new Error('현재 응답할 수 있는 설문이 없습니다.');
                const participation = await supabase.from('notice_responses').select('status,is_attended').eq('notice_id', program.id).eq('user_id', user.id).maybeSingle();
                if (participation.error) throw participation.error;
                if (participation.data?.status !== 'JOIN' || (link.audience === 'ATTENDED' && !participation.data.is_attended)) throw new Error(link.audience === 'ATTENDED' ? '출석이 확인된 참여자만 작성할 수 있습니다.' : '신청이 완료된 참여자만 작성할 수 있습니다.');
                if (program.program_status === 'CANCELLED') throw new Error('취소된 프로그램입니다.');
                const end = programSurveyEndAt(program);
                if (link.timing === 'AFTER_END' && program.program_status !== 'COMPLETED' && program.guest_properties?.is_ended !== true && (end == null || Date.now() < end)) throw new Error('프로그램 종료 후 작성할 수 있습니다.');
                const prior = await supabase.from('survey_entries').select('*').eq('link_id', link.id).eq('user_id', user.id).eq('response_key','ONCE').maybeSingle();
                if (prior.error) throw prior.error;
                if (active) setState({ link, userId: user.id, entry: prior.data });
            } catch (e) { if (active) setState({ error: e.message }); }
        })();
        return () => { active = false; };
    }, [program.id]);
    if (state.legacy) return legacy;
    if (state.link) return <SurveyRunner manageHistory={false} link={state.link} userId={state.userId} initialEntry={state.entry} onClose={onClose} onComplete={entry => onSuccess?.(entry)} />;
    return <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-4"><div className="rounded-2xl bg-white p-6 space-y-4"><p role={state.error ? 'alert' : undefined}>{state.loading ? '설문을 불러오는 중…' : state.error}</p><button className="rounded-xl border px-4 py-2" onClick={onClose}>닫기</button></div></div>;
}
