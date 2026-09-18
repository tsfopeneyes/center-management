import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import SurveyFields from './SurveyFields';
import { surveyHubApi } from '../../api/surveyHubApi';
import { answerSummary, recommendationsFor, validateAnswers } from '../../utils/surveyModel';
import useModalClose from '../../hooks/useModalClose';

export default function SurveyRunner({ link, userId, onComplete, onClose, initialEntry, locationId, visitId, onSubmit, inline = false, manageHistory = true, dismissible = true }) {
    const [answers, setAnswers] = useState(initialEntry?.answers || {});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [recommendationPreview, setRecommendationPreview] = useState(null);
    const lock = useRef(false);
    const saved = useRef(null);
    useModalClose(!inline && manageHistory, () => { if (!lock.current) onClose?.(); });
    useEffect(() => {
        if (inline) return;
        const original = document.body.style.overflow; document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = original; };
    }, [inline]);
    const definition = initialEntry?.snapshot || link.version.definition;
    useEffect(() => { setAnswers(initialEntry?.answers || {}); setRecommendationPreview(null); saved.current = null; }, [link.id, initialEntry?.id]);
    const persist = async () => {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError('');
        try {
            if (onSubmit) {
                const result = await onSubmit(answers, answerSummary(definition, answers));
                await onComplete?.(result, answerSummary(definition, answers));
            } else {
                if (!saved.current) saved.current = await surveyHubApi.submit({ ...link, version: { ...link.version, definition } }, userId, answers, { locationId, visitId });
                await onComplete?.(saved.current, answerSummary(saved.current.snapshot || definition, saved.current.answers || answers));
            }
        } catch (e) { setError(e.code === '23505' ? '이미 제출한 설문입니다. 닫기를 눌러 계속해 주세요.' : e.message); }
        finally { lock.current = false; setBusy(false); }
    };
    const content = <div className={`w-full max-w-2xl overflow-y-auto bg-white ${inline ? 'min-h-screen p-5 sm:min-h-0 sm:rounded-[30px] sm:border sm:border-black/[0.06] sm:p-9 sm:shadow-[0_18px_55px_rgba(45,35,31,0.09)]' : 'max-h-[90dvh] rounded-[28px] p-6 shadow-xl sm:p-8'}`}>
        <header className="mb-8 border-b border-tossGrey100 pb-7"><div className="mb-5 h-1.5 w-12 rounded-full bg-haifnRed" /><div className="flex items-start justify-between gap-4"><div><p className="mb-2 text-xs font-black text-haifnRed">하이픈 설문</p><h2 className="text-2xl font-black leading-tight tracking-[-0.025em] text-tossGrey900">{definition.title}</h2></div>{dismissible && <button type="button" aria-label="설문 닫기" disabled={busy} onClick={onClose} className="shrink-0 rounded-xl px-3 py-2 text-sm font-bold text-tossGrey500 transition hover:bg-tossGrey50">닫기</button>}</div>{definition.description && !recommendationPreview && <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-6 text-tossGrey600">{definition.description}</p>}</header>
        {recommendationPreview ? <div className="space-y-4"><div className="rounded-2xl bg-[#F8E8E4] p-4"><p className="flex items-center gap-2 font-black text-haifnRed"><Sparkles size={18} />선택한 답변에 맞는 추천</p><p className="mt-1 text-sm font-medium text-[#8E3024]">추천을 확인하고 설문을 완료해 주세요.</p></div>{recommendationPreview.map(item => <article key={item.id} className="flex gap-3 rounded-2xl border border-tossGrey100 bg-white p-4"><span className="text-2xl">{item.emoji}</span><div><p className="font-bold text-tossGrey900">{item.title}</p>{item.text && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-tossGrey600">{item.text}</p>}</div></article>)}</div> : <SurveyFields definition={definition} answers={answers} disabled={busy || !!saved.current} onChange={(id, value) => setAnswers(a => ({ ...a, [id]: value }))} />}
        {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}
        <div className="mt-9 flex flex-col-reverse gap-2.5 border-t border-tossGrey100 pt-5 sm:flex-row sm:justify-end"><button type="button" disabled={busy} className="rounded-2xl bg-haifnRed px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-haifnRedHover disabled:bg-tossGrey300" onClick={async () => {
            if (!recommendationPreview) {
                const validation = validateAnswers(definition, answers); if (validation) return setError(validation);
                const recommendations = recommendationsFor(definition, answers);
                if (recommendations.length) { setError(''); setRecommendationPreview(recommendations); return; }
            }
            await persist();
        }}>{busy ? '저장 중…' : recommendationPreview ? '설문 완료' : initialEntry ? '답변 수정' : '응답 제출하기'}</button>{recommendationPreview ? <button type="button" disabled={busy} onClick={() => setRecommendationPreview(null)} className="rounded-2xl px-5 py-3 text-sm font-bold text-tossGrey600 hover:bg-tossGrey50">답변 수정</button> : dismissible && <button type="button" disabled={busy} onClick={onClose} className="rounded-2xl px-5 py-3 text-sm font-bold text-tossGrey500 hover:bg-tossGrey50">나중에 하기</button>}</div>
    </div>;
    return inline ? content : <div role="dialog" aria-modal="true" aria-label={definition.title} className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-4">{content}</div>;
}
