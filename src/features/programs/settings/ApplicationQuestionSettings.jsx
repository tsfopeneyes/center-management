import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { legacyGuestDraftQuestions, materializeProgramApplicationForm } from '../applicationFormModel';
import { isProgramApplicationTransitionEnabled } from '../application/applicationTransition';

const AUDIENCES = [
    { value: 'MEMBER', label: '회원' },
    { value: 'GUEST', label: '비회원' },
    { value: 'ALL', label: '모두' },
];

function ChoiceOptionsInput({ question, onChange }) {
    const [draft, setDraft] = useState(() => (question.options || []).join(', '));
    useEffect(() => {
        setDraft((question.options || []).join(', '));
    }, [question.id, question.options]);
    const commit = () => onChange(draft.split(',').map(value => value.trim()).filter(Boolean));
    return (
        <label className="mt-3 block space-y-1.5 text-xs font-bold text-slate-700">
            선택지 (쉼표로 구분, 2개 이상)
            <input type="text" value={draft}
                onChange={event => setDraft(event.target.value)}
                onBlur={commit}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </label>
    );
}

function ApplicationQuestionSettings({ formData, updateField }) {
    if (!formData.is_recruiting) return null;

    // A published canonical form must never be edited through legacy fields,
    // even if a staged environment temporarily disables the new application path.
    const legacyOnly = !isProgramApplicationTransitionEnabled() && !formData.application_form;
    const isLegacy = !formData.application_form;
    const questions = legacyOnly
        ? legacyGuestDraftQuestions(formData.guest_properties)
        : materializeProgramApplicationForm(formData.application_form, formData.guest_properties).questions;
    const updateQuestions = next => {
        if (legacyOnly) {
            updateField('guest_properties', {
                ...(formData.guest_properties || {}),
                custom_fields: next.map(({ id, label, type, required, options }) => ({ id, label, type, required, options })),
            });
        } else {
            updateField('application_form', { questions: next });
        }
    };
    const updateQuestion = (index, patch) => updateQuestions(questions.map((question, position) =>
        position === index ? { ...question, ...patch } : question));
    const addQuestion = () => updateQuestions([...questions, {
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: '', type: 'text', required: false, audience: legacyOnly ? 'GUEST' : 'MEMBER', options: [],
    }]);

    return (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h4 className="text-sm font-bold text-slate-800">추가 질문</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {legacyOnly
                            ? '비회원 신청에 표시할 질문을 추가하세요.'
                            : '신청자에게만 표시할 질문을 추가하고, 회원·비회원·모두 중 대상을 선택하세요.'}
                    </p>
                    {isLegacy && questions.length > 0 && (
                        <p className="mt-2 text-xs text-slate-500">기존 비회원 질문의 답변 연결을 위해 질문 식별자를 유지합니다.</p>
                    )}
                    {legacyOnly && <p className="mt-2 text-xs text-slate-500">회원 질문은 신청 DB 전환 후 사용할 수 있습니다.</p>}
                </div>
                <button type="button" onClick={addQuestion}
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                    질문 추가
                </button>
            </div>
            {questions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-600">
                    추가 질문이 없습니다. 기본 신청 정보만 받습니다.
                </p>
            ) : (
                <ol className="space-y-3">
                    {questions.map((question, index) => (
                        <li key={question.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                            <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <label htmlFor={`application-question-${question.id}`} className="block text-xs font-bold text-slate-700">
                                        질문 {index + 1}
                                    </label>
                                    <input id={`application-question-${question.id}`} type="text" maxLength={200}
                                        value={question.label || ''}
                                        onChange={event => updateQuestion(index, { label: event.target.value })}
                                        placeholder="신청자에게 표시할 질문"
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                                </div>
                                <button type="button" onClick={() => updateQuestions(questions.filter((_, position) => position !== index))}
                                    aria-label={`질문 ${index + 1} 삭제`}
                                    className="mt-5 rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                {legacyOnly ? (
                                    <div className="space-y-1.5 text-xs font-bold text-slate-700">
                                        대상
                                        <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">비회원</div>
                                    </div>
                                ) : (
                                    <label className="block space-y-1.5 text-xs font-bold text-slate-700">
                                        대상
                                        <select value={question.audience || 'GUEST'}
                                            onChange={event => updateQuestion(index, { audience: event.target.value })}
                                            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
                                            {AUDIENCES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </label>
                                )}
                                <label className="block space-y-1.5 text-xs font-bold text-slate-700">
                                    답변 방식
                                    <select value={question.type || 'text'}
                                        onChange={event => updateQuestion(index, { type: event.target.value, options: event.target.value === 'select' ? (question.options || []) : [] })}
                                        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
                                        <option value="text">단답형</option>
                                        <option value="textarea">장문형</option>
                                        <option value="select">선택형</option>
                                    </select>
                                </label>
                                <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700">
                                    <input type="checkbox" checked={question.required === true}
                                        onChange={event => updateQuestion(index, { required: event.target.checked })} />
                                    필수 답변
                                </label>
                            </div>
                            {question.type === 'select' && (
                                <ChoiceOptionsInput question={question}
                                    onChange={options => updateQuestion(index, { options })} />
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

export default React.memo(ApplicationQuestionSettings);
