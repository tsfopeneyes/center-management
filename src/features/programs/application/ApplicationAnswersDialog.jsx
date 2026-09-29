import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { materializeProgramApplicationForm, questionsForAudience, validateApplicationAnswers } from '../applicationFormModel';

export const formForNotice = notice => materializeProgramApplicationForm(
    notice?.application_form, notice?.guest_properties
);

export const hasApplicationQuestions = (notice, audience) =>
    questionsForAudience(formForNotice(notice), audience).length > 0;

function ApplicationAnswersDialog({ notice, audience, onClose, onSubmit }) {
    const [answers, setAnswers] = useState({});
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const form = formForNotice(notice);
    const questions = questionsForAudience(form, audience);

    const handleSubmit = async event => {
        event.preventDefault();
        const validationError = validateApplicationAnswers(form, audience, answers);
        if (validationError) {
            setError(validationError);
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const completed = await onSubmit(answers);
            if (completed !== false) onClose();
        } catch (submissionError) {
            setError(submissionError?.message || '신청을 저장하지 못했습니다. 다시 시도해 주세요.');
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 p-4" role="presentation">
            <section role="dialog" aria-modal="true" aria-labelledby="application-answers-title"
                className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="border-b border-slate-200 px-5 py-4">
                    <h3 id="application-answers-title" className="text-base font-bold text-slate-900">추가 신청 정보</h3>
                    <p className="mt-1 text-xs text-slate-600">{notice?.title} 신청에 필요한 질문입니다.</p>
                </div>
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
                    <div className="space-y-4 overflow-y-auto px-5 py-5">
                        {questions.map(question => (
                            <label key={question.id} className="block space-y-2 text-sm font-bold text-slate-800">
                                {question.label}{question.required && <span className="ml-1 text-red-600">*</span>}
                                {question.type === 'textarea' ? (
                                    <textarea rows={4} required={question.required} maxLength={3000}
                                        value={answers[question.id] || ''}
                                        onChange={event => setAnswers(previous => ({ ...previous, [question.id]: event.target.value }))}
                                        className="block w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                                ) : question.type === 'select' ? (
                                    <select required={question.required} value={answers[question.id] || ''}
                                        onChange={event => setAnswers(previous => ({ ...previous, [question.id]: event.target.value }))}
                                        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
                                        <option value="">선택해 주세요</option>
                                        {(question.options || []).map(option => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                ) : (
                                    <input type="text" required={question.required} maxLength={3000}
                                        value={answers[question.id] || ''}
                                        onChange={event => setAnswers(previous => ({ ...previous, [question.id]: event.target.value }))}
                                        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                                )}
                            </label>
                        ))}
                        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}
                    </div>
                    <div className="flex gap-2 border-t border-slate-200 px-5 py-4">
                        <button type="button" onClick={onClose} disabled={submitting}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">
                            돌아가기
                        </button>
                        <button type="submit" disabled={submitting}
                            className="flex-1 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                            {submitting ? '신청 중...' : '신청하기'}
                        </button>
                    </div>
                </form>
            </section>
        </div>, document.body
    );
}

export default ApplicationAnswersDialog;
