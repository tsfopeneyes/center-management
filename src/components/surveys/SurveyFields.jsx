import React from 'react';
import { optionsOf } from '../../utils/surveyModel';

export default function SurveyFields({ definition, answers, onChange, disabled = false }) {
    const field = 'w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900';
    return <div className="space-y-6">{definition.questions.map((q, index) => <fieldset key={q.id} disabled={disabled} className="space-y-3">
        <legend className="mb-2 font-bold text-gray-900">{index + 1}. {q.title} {q.required && <span className="text-red-600">*</span>}</legend>
        {['short', 'text'].includes(q.type) ? (q.type === 'text'
            ? <textarea aria-label={q.title} className={field} rows={4} maxLength={5000} value={answers[q.id] || ''} onChange={e => onChange(q.id, e.target.value)} />
            : <input aria-label={q.title} className={field} maxLength={5000} value={answers[q.id] || ''} onChange={e => onChange(q.id, e.target.value)} />)
            : q.type === 'star' ? <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={q.title}>{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} aria-pressed={answers[q.id] === n} aria-label={`${n}점`} onClick={() => onChange(q.id, n)} className={`rounded-xl border py-3 px-1 ${answers[q.id] === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'}`}>★ {n}</button>)}{!q.required && <button type="button" className="col-span-5 text-sm" onClick={() => onChange(q.id, null)}>선택 취소</button>}</div>
                : <div className="space-y-2">{optionsOf(q).map(option => <label key={option} className="flex gap-3 items-center rounded-xl border bg-white p-3 cursor-pointer"><input type={q.type === 'multiple' ? 'checkbox' : 'radio'} name={`survey-${q.id}`} checked={q.type === 'multiple' ? (answers[q.id] || []).includes(option) : answers[q.id] === option} onChange={() => onChange(q.id, q.type === 'multiple' ? ((answers[q.id] || []).includes(option) ? answers[q.id].filter(v => v !== option) : [...(answers[q.id] || []), option]) : option)} /><span>{option}</span></label>)}{!q.required && q.type === 'choice' && answers[q.id] != null && <button type="button" className="text-sm text-gray-500" onClick={() => onChange(q.id, null)}>선택 취소</button>}</div>}
    </fieldset>)}</div>;
}
