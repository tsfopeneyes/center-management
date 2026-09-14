import React from 'react';
import { BarChart3, MessageSquareText, Star, Users, X } from 'lucide-react';
import { legacyFeedbackDisplay, feedbackRating } from '../../utils/programFeedbackModel';
import { optionsOf } from '../../utils/surveyModel';
import useModalClose from '../../hooks/useModalClose';

// The overview follows the same question-first layout as the legacy report.
const isAnswered = value => value != null && value !== '' && (!Array.isArray(value) || value.length > 0);
const formatAnswer = value => Array.isArray(value) ? value.join(', ') : String(value ?? '');

function aggregateQuestions(rows) {
    const groups = new Map();
    rows.filter(row => !row.aggregation_excluded).forEach(row => {
        (row.snapshot?.questions || []).forEach(question => {
            const value = row.answers?.[question.id];
            if (!isAnswered(value)) return;
            const key = JSON.stringify([question.title, question.type, optionsOf(question), question.metric || null]);
            if (!groups.has(key)) groups.set(key, { key, question, count: 0, sum: 0, choices: {}, stars: {}, texts: [] });
            const group = groups.get(key);
            group.count += 1;
            if (question.type === 'star') {
                const score = Number(value);
                if (score >= 1 && score <= 5) { group.sum += score; group.stars[score] = (group.stars[score] || 0) + 1; }
            } else if (['choice', 'multiple'].includes(question.type)) {
                [].concat(value).forEach(option => { group.choices[option] = (group.choices[option] || 0) + 1; });
            } else {
                group.texts.push({ value: String(value), name: row.users?.name || '응답자', school: row.users?.school || '' });
            }
        });
    });
    return [...groups.values()];
}

function QuestionAnalysis({ group, number }) {
    const { question, count } = group;
    const options = question.type === 'star' ? [5, 4, 3, 2, 1] : optionsOf(question);
    return <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-blue-600">Q{String(number).padStart(2, '0')} · {question.type === 'star' ? '평점' : ['choice','multiple'].includes(question.type) ? '선택형' : '주관식'}</p><h3 className="mt-1 font-bold leading-6 text-gray-900">{question.title}</h3></div><span className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-500">응답 {count}건</span></div>
        {question.type === 'star' && <><div className="mb-5 flex items-end gap-2"><strong className="text-3xl font-black text-gray-900">{count ? (group.sum / count).toFixed(1) : '—'}</strong><span className="pb-1 text-sm font-bold text-gray-400">/ 5</span><div className="mb-1 ml-2 flex text-amber-400">{[1,2,3,4,5].map(value => <Star key={value} size={17} fill={value <= Math.round(group.sum / count) ? 'currentColor' : 'none'} />)}</div></div><div className="space-y-2">{options.map(score => { const amount = group.stars[score] || 0; const percent = count ? Math.round(amount / count * 100) : 0; return <div key={score} className="grid grid-cols-[34px_1fr_76px] items-center gap-3 text-xs"><span className="font-bold text-gray-500">{score}점</span><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${percent}%` }} /></div><span className="text-right font-bold text-gray-500">{amount}명 · {percent}%</span></div>; })}</div></>}
        {['choice','multiple'].includes(question.type) && <div className="space-y-3">{options.map(option => { const amount = group.choices[option] || 0; const percent = count ? Math.round(amount / count * 100) : 0; return <div key={option}><div className="mb-2 flex justify-between gap-3 text-sm font-bold"><span className="text-gray-800">{option}</span><span className="shrink-0 text-gray-500">{amount}명 · {percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} /></div></div>; })}</div>}
        {['short','text'].includes(question.type) && <div className="grid gap-3 md:grid-cols-2">{group.texts.map((answer, index) => <article key={`${answer.name}-${index}`} className="rounded-xl bg-gray-50 p-4"><p className="whitespace-pre-wrap text-sm font-medium leading-6 text-gray-800">{answer.value}</p><p className="mt-3 text-xs font-bold text-gray-400">{answer.name}{answer.school ? ` · ${answer.school}` : ''}</p></article>)}</div>}
    </section>;
}

export default function ProgramSurveyResults({ program, feedbacks = [], onClose, loading, error }) {
    useModalClose(true, onClose);
    const rows = feedbacks.map(row => legacyFeedbackDisplay(row, row.notices || program));
    const includedRows = rows.filter(row => !row.aggregation_excluded);
    const ratings = feedbacks.filter(row => !row.aggregation_excluded).map(feedbackRating).filter(value => value != null);
    const groups = aggregateQuestions(rows);
    const average = ratings.length ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1) : null;

    return <div role="dialog" aria-modal="true" aria-label="프로그램 설문 결과" className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-3 md:p-6"><section className="max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-[24px] bg-[#f7f8fa] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-5 md:px-7"><div><p className="text-xs font-bold text-blue-600">프로그램 피드백 결과</p><h2 className="mt-1 text-xl font-black text-gray-900 md:text-2xl">{program?.title}</h2></div><button onClick={onClose} aria-label="닫기" className="rounded-full bg-gray-50 p-2.5 text-gray-500 hover:bg-gray-100"><X size={20} /></button></header>
        <div className="space-y-6 p-4 md:p-7">
            {loading && <p className="rounded-2xl bg-white p-10 text-center text-gray-500">불러오는 중…</p>}
            {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-red-600">{error}</p>}
            {!loading && !rows.length && <p className="rounded-2xl bg-white p-10 text-center text-gray-500">아직 응답이 없습니다.</p>}
            {!loading && rows.length > 0 && <>
                <section><div className="mb-3 flex items-center gap-2"><BarChart3 className="text-blue-600" size={20} /><h3 className="font-black text-gray-900">종합 분석</h3></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white p-5 shadow-sm"><Users className="mb-3 text-blue-600" size={20} /><p className="text-xs font-bold text-gray-400">전체 응답</p><p className="mt-1 text-2xl font-black text-gray-900">{rows.length}건</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><BarChart3 className="mb-3 text-emerald-600" size={20} /><p className="text-xs font-bold text-gray-400">분석 포함</p><p className="mt-1 text-2xl font-black text-gray-900">{includedRows.length}건</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><Star className="mb-3 text-amber-400" fill="currentColor" size={20} /><p className="text-xs font-bold text-gray-400">평균 만족도</p><p className="mt-1 text-2xl font-black text-gray-900">{average ? `${average} / 5` : '해당 문항 없음'}</p></div></div></section>
                <div className="space-y-4">{groups.map((group, index) => <QuestionAnalysis key={group.key} group={group} number={index + 1} />)}</div>
                <section><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MessageSquareText className="text-blue-600" size={20} /><h3 className="font-black text-gray-900">개별 응답</h3></div><span className="text-xs font-bold text-gray-400">{rows.length}건</span></div><div className="space-y-3">{rows.map((row, index) => <article key={row.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${row.aggregation_excluded ? 'border-gray-200 opacity-60' : 'border-gray-100'}`}><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold text-gray-900">{row.users?.name || '응답자'} <span className="font-medium text-gray-400">{row.users?.school || ''}</span></p><p className="mt-1 text-xs text-gray-400">{new Date(row.created_at).toLocaleString('ko-KR')}</p></div><div className="flex gap-2"><span className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-500">응답 {index + 1}</span>{row.aggregation_excluded && <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">집계 제외</span>}</div></div>{row.legacy && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">기존 응답이며 당시 질문이 없는 맞춤 설문은 현재 설정을 기준으로 표시합니다.</p>}<div className="grid gap-3 md:grid-cols-2">{(row.snapshot?.questions || []).filter(question => isAnswered(row.answers?.[question.id])).map(question => <div key={question.id} className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-bold leading-5 text-gray-400">{question.title}</p><p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6 text-gray-800">{question.type === 'star' ? `${formatAnswer(row.answers[question.id])} / 5` : formatAnswer(row.answers[question.id])}</p></div>)}</div></article>)}</div></section>
            </>}
        </div>
    </section></div>;
}
