import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import SurveyFields from './SurveyFields';
import { surveyHubApi } from '../../api/surveyHubApi';
import { answerSummary, recommendationsFor, validateAnswers } from '../../utils/surveyModel';
import useModalClose from '../../hooks/useModalClose';

export default function SurveyRunner({ link, userId, onComplete, onClose, initialEntry, locationId, visitId, onSubmit, inline = false, manageHistory = true }) {
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
    const content = <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto space-y-5">
        <div className="flex justify-between gap-4"><h2 className="text-xl font-bold">{definition.title}</h2><button type="button" aria-label="설문 닫기" disabled={busy} onClick={onClose}>닫기</button></div>
        {recommendationPreview ? <div className="space-y-4"><div className="rounded-2xl bg-blue-50 p-4"><p className="flex items-center gap-2 font-black text-blue-700"><Sparkles size={18} />선택한 답변에 맞는 추천</p><p className="mt-1 text-sm text-blue-600">추천을 확인하고 설문을 완료해 주세요.</p></div>{recommendationPreview.map(item => <article key={item.id} className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><span className="text-2xl">{item.emoji}</span><div><p className="font-bold text-gray-900">{item.title}</p>{item.text && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-600">{item.text}</p>}</div></article>)}</div> : <>{definition.description && <p className="text-gray-600 whitespace-pre-wrap">{definition.description}</p>}<SurveyFields definition={definition} answers={answers} disabled={busy || !!saved.current} onChange={(id, value) => setAnswers(a => ({ ...a, [id]: value }))} /></>}
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <div className="flex gap-3"><button type="button" disabled={busy} className="rounded-xl bg-blue-600 px-5 py-3 text-white font-bold" onClick={async () => {
            if (!recommendationPreview) {
                const validation = validateAnswers(definition, answers); if (validation) return setError(validation);
                const recommendations = recommendationsFor(definition, answers);
                if (recommendations.length) { setError(''); setRecommendationPreview(recommendations); return; }
            }
            await persist();
        }}>{busy ? '저장 중…' : recommendationPreview ? '설문 완료' : initialEntry ? '답변 수정' : '제출하기'}</button>{recommendationPreview ? <button type="button" disabled={busy} onClick={() => setRecommendationPreview(null)}>답변 수정</button> : <button type="button" disabled={busy} onClick={onClose}>나중에 하기</button>}</div>
    </div>;
    return inline ? content : <div role="dialog" aria-modal="true" aria-label={definition.title} className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-4">{content}</div>;
}
