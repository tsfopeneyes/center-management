import React, { useEffect, useRef, useState } from 'react';
import SurveyFields from './SurveyFields';
import { surveyHubApi } from '../../api/surveyHubApi';
import { answerSummary, validateAnswers } from '../../utils/surveyModel';
import useModalClose from '../../hooks/useModalClose';

export default function SurveyRunner({ link, userId, onComplete, onClose, initialEntry, locationId, visitId, onSubmit, inline = false, manageHistory = true }) {
    const [answers, setAnswers] = useState(initialEntry?.answers || {});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const lock = useRef(false);
    const saved = useRef(null);
    useModalClose(!inline && manageHistory, () => { if (!lock.current) onClose?.(); });
    useEffect(() => {
        if (inline) return;
        const original = document.body.style.overflow; document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = original; };
    }, [inline]);
    const definition = initialEntry?.snapshot || link.version.definition;
    useEffect(() => { setAnswers(initialEntry?.answers || {}); saved.current = null; }, [link.id, initialEntry?.id]);
    const content = <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto space-y-5">
        <div className="flex justify-between gap-4"><h2 className="text-xl font-bold">{definition.title}</h2><button type="button" aria-label="설문 닫기" disabled={busy} onClick={onClose}>닫기</button></div>
        {definition.description && <p className="text-gray-600 whitespace-pre-wrap">{definition.description}</p>}
        <SurveyFields definition={definition} answers={answers} disabled={busy || !!saved.current} onChange={(id, value) => setAnswers(a => ({ ...a, [id]: value }))} />
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <div className="flex gap-3"><button type="button" disabled={busy} className="rounded-xl bg-blue-600 px-5 py-3 text-white font-bold" onClick={async () => {
            if (lock.current) return;
            const validation = validateAnswers(definition, answers); if (validation) return setError(validation);
            lock.current = true; setBusy(true); setError('');
            try {
                if (onSubmit) { await onSubmit(answers, answerSummary(definition, answers)); }
                else {
                    if (!saved.current) saved.current = await surveyHubApi.submit({ ...link, version: { ...link.version, definition } }, userId, answers, { locationId, visitId });
                    await onComplete?.(saved.current, answerSummary(saved.current.snapshot || definition, saved.current.answers || answers));
                }
            } catch (e) { setError(e.code === '23505' ? '이미 제출한 설문입니다. 닫기를 눌러 계속해 주세요.' : e.message); }
            finally { lock.current = false; setBusy(false); }
        }}>{busy ? '저장 중…' : saved.current ? '계속하기' : initialEntry ? '답변 수정' : '제출하기'}</button><button type="button" disabled={busy} onClick={onClose}>나중에 하기</button></div>
    </div>;
    return inline ? content : <div role="dialog" aria-modal="true" aria-label={definition.title} className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-4">{content}</div>;
}
