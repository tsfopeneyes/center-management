import React from 'react';
import { ArrowLeft, EyeOff, RotateCcw, Star, Users } from 'lucide-react';
import { optionsOf, questionSignature } from '../../utils/surveyModel';

const hasAnswer = value => value != null && value !== '' && (!Array.isArray(value) || value.length > 0);
const textValue = value => Array.isArray(value) ? value.join(', ') : String(value ?? '');

function summarize(entries) {
    const groups = new Map();
    entries.filter(entry => !entry.aggregation_excluded).forEach(entry => {
        (entry.snapshot?.questions || []).forEach(question => {
            const value = entry.answers?.[question.id];
            if (!hasAnswer(value)) return;
            const key = questionSignature(question);
            if (!groups.has(key)) groups.set(key, { key, question, count: 0, sum: 0, choices: {}, stars: {}, texts: [] });
            const group = groups.get(key);
            group.count += 1;
            if (question.type === 'star') {
                const score = Number(value);
                group.sum += score;
                group.stars[score] = (group.stars[score] || 0) + 1;
            } else if (['choice','multiple'].includes(question.type)) {
                [].concat(value).forEach(option => { group.choices[option] = (group.choices[option] || 0) + 1; });
            } else group.texts.push({ value: String(value), name: entry.users?.name || '응답자' });
        });
    });
    return [...groups.values()];
}

function ResultCard({ group }) {
    const { question, count } = group;
    if (['short','text'].includes(question.type)) return <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-black text-gray-900">{question.title}</h3><span className="text-xs font-bold text-gray-400">{count}건</span></div><div className="grid gap-3 md:grid-cols-2">{group.texts.map((answer,index) => <article key={index} className="rounded-2xl bg-gray-50 p-4"><p className="whitespace-pre-wrap text-sm font-medium leading-6 text-gray-800">{answer.value}</p><p className="mt-3 text-xs font-bold text-gray-400">{answer.name}</p></article>)}</div></section>;
    const options = question.type === 'star' ? [5,4,3,2,1] : optionsOf(question);
    return <section><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><h3 className="font-black text-gray-900">{question.title}</h3>{question.type === 'star' && <span className="flex items-center gap-1 text-sm font-bold text-amber-500"><Star size={16} fill="currentColor" />{count ? (group.sum / count).toFixed(1) : '—'} / 5</span>}</div><div className="grid gap-4 md:grid-cols-2">{options.map(option => { const amount = question.type === 'star' ? (group.stars[option] || 0) : (group.choices[option] || 0); const percent = count ? Math.round(amount / count * 100) : 0; return <div key={option} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex justify-between gap-3 text-sm font-bold"><span className="text-gray-900">{question.type === 'star' ? `${option}점` : option}</span><span className="shrink-0 text-gray-900">{amount}명 · {percent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${question.type === 'star' ? 'bg-amber-400' : 'bg-blue-600'}`} style={{ width: `${percent}%` }} /></div></div>; })}</div></section>;
}

export default function UnifiedSurveyResults({ form, entries, formLinks, label, filter, setFilter, versionFilter, setVersionFilter, showExcluded, setShowExcluded, busy, onBack, onToggleExclude }) {
    const filtered = entries.filter(entry => (filter === 'ALL' || entry.link_id === filter) && (versionFilter === 'ALL' || entry.version_id === versionFilter));
    const included = filtered.filter(entry => !entry.aggregation_excluded);
    const displayed = filtered.filter(entry => showExcluded ? entry.aggregation_excluded : !entry.aggregation_excluded);
    const excludedCount = filtered.length - included.length;
    const groups = summarize(included);
    const filterItems = [{ id: 'ALL', name: '전체' }, ...(entries.some(entry => entry.legacy) ? [{ id: 'LEGACY', name: '이전 응답' }] : []), ...formLinks.map(link => ({ id: link.id, name: label(link) }))];
    // The list, result header, filters, and charts all show the same
    // aggregation-included response set. Excluded rows remain available
    // through the separate excluded-response control.
    const countFor = id => entries.filter(entry => !entry.aggregation_excluded && (id === 'ALL' || entry.link_id === id)).length;
    return <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm md:flex-row md:items-center"><div className="flex items-center gap-3"><button onClick={onBack} className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-600 hover:bg-gray-50" title="설문 목록으로"><ArrowLeft size={18} /></button><div><p className="text-xs font-bold text-blue-600">설문 결과</p><h2 className="mt-0.5 text-xl font-black text-gray-900">{form.title}</h2></div></div><div className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-2 text-sm font-bold text-gray-600"><Users size={17} />집계 {included.length}건</span><button type="button" onClick={() => setShowExcluded(current => !current)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${showExcluded ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>{showExcluded ? '집계 응답 보기' : `제외된 응답 보기 (${excludedCount})`}</button></div></section>
        <section className="space-y-3 rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm"><div className="flex flex-wrap gap-2">{filterItems.map(item => <button key={item.id} onClick={() => setFilter(item.id)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${filter === item.id ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{item.name} <span className={filter === item.id ? 'text-white/70' : 'text-gray-400'}>{countFor(item.id)}건</span></button>)}</div>{form.survey_versions.length > 1 && <select className="w-full max-w-md rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500" aria-label="응답 버전 필터" value={versionFilter} onChange={event => setVersionFilter(event.target.value)}><option value="ALL">모든 질문 버전</option>{form.survey_versions.map(version => <option key={version.id} value={version.id}>{new Date(version.created_at).toLocaleString('ko-KR')} · {version.definition.title}</option>)}</select>}</section>
        <div className="space-y-6">{groups.map(group => <ResultCard key={group.key} group={group} />)}{!groups.length && included.length > 0 && <p className="rounded-[24px] border border-gray-100 bg-white p-8 text-center text-sm text-gray-400 shadow-sm">통계로 표시할 수 있는 응답이 없습니다. 개별 응답은 아래에서 확인할 수 있습니다.</p>}</div>
        <section className="overflow-x-auto rounded-[24px] border border-gray-100 bg-white shadow-sm"><table className="w-full min-w-[900px] text-sm"><thead className="bg-gray-50 text-gray-500"><tr><th className="px-5 py-4 text-left">응답자</th><th className="px-5 py-4 text-left">응답 내용</th><th className="px-5 py-4 text-left">적용 대상</th><th className="px-5 py-4 text-left">응답 일시</th><th className="px-5 py-4 text-left">집계</th></tr></thead><tbody>{displayed.map(entry => <tr key={entry.id} className={`border-t border-gray-100 ${entry.aggregation_excluded ? 'bg-gray-50 text-gray-400' : ''}`}><td className="px-5 py-4 align-top font-bold">{entry.users?.name || '응답자'}<span className="mt-1 block text-xs font-medium text-gray-400">{entry.users?.school || ''}</span></td><td className="max-w-xl px-5 py-4 align-top"><div className="space-y-2">{(entry.snapshot?.questions || []).filter(question => hasAnswer(entry.answers?.[question.id])).map(question => <div key={question.id}><span className="text-xs font-bold text-gray-400">{question.title}</span><p className="mt-0.5 whitespace-pre-wrap font-medium text-gray-800">{question.type === 'star' ? `${textValue(entry.answers[question.id])} / 5` : textValue(entry.answers[question.id])}</p></div>)}</div></td><td className="px-5 py-4 align-top whitespace-nowrap">{entry.legacy ? '이전 설문' : label(formLinks.find(link => link.id === entry.link_id) || { id: entry.link_id })}</td><td className="px-5 py-4 align-top whitespace-nowrap">{new Date(entry.created_at).toLocaleString('ko-KR')}</td><td className="px-5 py-4 align-top whitespace-nowrap">{entry.legacy ? <span className="text-xs text-gray-400">원본 보존</span> : <button disabled={busy} onClick={() => onToggleExclude(entry)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold disabled:opacity-50 ${entry.aggregation_excluded ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>{entry.aggregation_excluded ? <><RotateCcw size={13} />다시 포함</> : <><EyeOff size={13} />집계 제외</>}</button>}</td></tr>)}</tbody></table>{!displayed.length && <p className="p-10 text-center text-sm text-gray-400">{showExcluded ? '제외된 응답이 없습니다.' : '표시할 응답이 없습니다.'}</p>}</section>
    </div>;
}
