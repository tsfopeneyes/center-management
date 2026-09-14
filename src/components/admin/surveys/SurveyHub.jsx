import React, { useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList, Copy, Eye, Link2, Plus, Search, Unlink } from 'lucide-react';
import { surveyHubApi } from '../../../api/surveyHubApi';
import { feedbackApi } from '../../../api/feedbackApi';
import { supabase } from '../../../supabaseClient';
import { legacyDefinition } from '../../../utils/surveyModel';
import SurveyDefinitionEditor from '../../surveys/SurveyDefinitionEditor';
import UnifiedSurveyResults from '../../surveys/UnifiedSurveyResults';
import AdminFeedbackListModal from '../board/components/modals/AdminFeedbackListModal';
import AdminPageHeader from '../common/AdminPageHeader';
import { SURVEY_CENTERS } from '../../../utils/surveyAssignments';

const input = 'rounded-xl border border-gray-300 bg-white p-2.5';
const latest = form => [...(form.survey_versions || [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
const countBy = (rows, key) => (rows || []).reduce((counts, row) => {
    const value = row[key];
    if (value != null) counts[value] = (counts[value] || 0) + 1;
    return counts;
}, {});
const defaultFeedback = { title: '프로그램 피드백', questions: [
    { id: 'reason', title: '프로그램에 참여한 이유는 무엇인가요?', type: 'short', required: true },
    { id: 'experience', title: '어떤 경험을 했나요?', type: 'text', required: true },
    { id: 'satisfaction', title: '프로그램에 얼마나 만족하나요?', type: 'star', required: true, metric: 'satisfaction' },
    { id: 'best', title: '가장 좋았던 순간은 무엇인가요?', type: 'text', required: true },
    { id: 'improvement', title: '아쉬웠던 점은 무엇인가요?', type: 'text', required: true },
    { id: 'rejoin', title: '다시 참여하고 싶은 정도는?', type: 'star', required: true },
    { id: 'rejoin_reason', title: '그 이유를 알려주세요.', type: 'text', required: true },
    { id: 'comment', title: '추가 의견', type: 'text', required: false }
] };

export default function SurveyHub({ onLegacy, notices = [], responses = [], visitNotes = [], users = [] }) {
    const [forms, setForms] = useState([]), [links, setLinks] = useState([]), [programs, setPrograms] = useState([]);
    const [error, setError] = useState(''), [ready, setReady] = useState(true), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
    const [selected, setSelected] = useState(null), [editor, setEditor] = useState(null), [view, setView] = useState('list'), [entries, setEntries] = useState([]);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('ALL'), [versionFilter, setVersionFilter] = useState('ALL'), [showExcluded, setShowExcluded] = useState(false);
    const [legacyProgram, setLegacyProgram] = useState(null);
    const [sectionTab, setSectionTab] = useState('SURVEYS');
    const [formEntryCounts, setFormEntryCounts] = useState({});
    const [programFeedbackCounts, setProgramFeedbackCounts] = useState({});
    const reload = async () => {
        setLoading(true);
        setError('');
        try {
            const [catalog, connections, programResult, allEntries, legacyEntryCounts, allFeedbacks] = await Promise.all([
                surveyHubApi.catalog(),
                surveyHubApi.links(),
                supabase.from('notices').select('id,title,guest_properties,program_status,program_type,program_date,program_end_date').eq('category', 'PROGRAM').order('created_at', { ascending: false }),
                surveyHubApi.entries(),
                surveyHubApi.legacyEntryCounts({ responses, visitNotes, users, notices }),
                feedbackApi.fetchAllFeedbacks()
            ]);
            if (programResult.error) throw programResult.error;
            setForms(catalog); setLinks(connections); setPrograms(programResult.data || []); setReady(true);
            const modernEntryCounts = countBy(allEntries.filter(entry => !entry.aggregation_excluded), 'form_id');
            const counts = Object.keys(legacyEntryCounts).reduce((totals, id) => ({ ...totals, [id]: (totals[id] || 0) + legacyEntryCounts[id] }), modernEntryCounts);
            catalog.filter(item => item.kind === 'TEMPLATE').forEach(template => {
                counts[template.id] = (counts[template.id] || 0) + catalog
                    .filter(item => item.kind === 'PROGRAM' && item.source_template_id === template.id)
                    .reduce((sum, item) => sum + (counts[item.id] || 0), 0);
            });
            setFormEntryCounts(counts);
            setProgramFeedbackCounts(countBy(allFeedbacks.filter(row => !row.aggregation_excluded), 'notice_id'));
        } catch (e) {
            // Do not conceal relation-query failures as a missing feature.
            setReady(true);
            setError(`통합 설문을 불러오지 못했습니다: ${e.message}`);
        }
        finally { setLoading(false); }
    };
    useEffect(() => { reload(); }, []);
    const execute = async action => { setBusy(true); setError(''); try { await action(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    const form = forms.find(f => f.id === selected);
    const relatedProgramForms = form?.kind === 'TEMPLATE' ? forms.filter(item => item.kind === 'PROGRAM' && item.source_template_id === form.id) : [];
    const resultFormIds = new Set([selected, ...relatedProgramForms.map(item => item.id)]);
    const formLinks = links.filter(link => resultFormIds.has(link.form_id));
    const label = link => link.id === 'LEGACY' || link.link_id === 'LEGACY' ? '이전 설문 응답' : link.event === 'PUBLIC' ? '공유 링크' : link.notice_id ? (programs.find(p => String(p.id) === String(link.notice_id))?.title || '프로그램') : `${SURVEY_CENTERS.find(c => c.code === link.center_code)?.label} ${link.event === 'CHECKIN' ? '입실' : '퇴실'}`;
    const loadResultEntries = async id => {
        return surveyHubApi.entries(id, { responses, visitNotes, users, notices });
    };
    const loadResults = async id => { setEntries([]); setView('results'); setSelected(id); setFilter('ALL'); setVersionFilter('ALL'); setEntries(await loadResultEntries(id)); };
    const reusableForms = forms.filter(f => f.kind !== 'PROGRAM');
    const visibleForms = reusableForms.filter(f => (latest(f)?.definition.title || f.title).toLowerCase().includes(query.trim().toLowerCase()));
    const hasProgramSurvey = program => links.some(link => link.enabled && link.event === 'PROGRAM' && String(link.notice_id) === String(program.id));
    const feedbackPrograms = programs.filter(program => ((programFeedbackCounts[program.id] || 0) > 0 || hasProgramSurvey(program)) && program.title.toLowerCase().includes(query.trim().toLowerCase()));
    const importLegacy = async () => {
        const result = await supabase.from('surveys').select('*').order('created_at', { ascending: false });
        if (result.error) throw result.error;
        setEditor({ imports: result.data || [] }); setView('import');
    };
    const setVisitConnection = async (targetForm, centerCode, event, state) => {
        const activeForThisForm = links.find(link => link.enabled && link.form_id === targetForm.id && link.center_code === centerCode && link.event === event);
        if (state === 'OFF') {
            if (!activeForThisForm) return;
            await surveyHubApi.updateLink(activeForThisForm.id, { enabled: false });
            await reload();
            return;
        }
        const isDefault = state === 'DEFAULT';
        // Each visit point has one normal survey and one optional fallback.
        // Changing a slot replaces only another survey in that same slot.
        for (const conflict of links.filter(link => link.enabled && !!link.is_default === isDefault && link.id !== activeForThisForm?.id && link.center_code === centerCode && link.event === event)) {
            await surveyHubApi.updateLink(conflict.id, { enabled: false });
        }
        const reusable = activeForThisForm || links.find(link => !link.enabled && link.form_id === targetForm.id && link.center_code === centerCode && link.event === event);
        if (reusable) await surveyHubApi.updateLink(reusable.id, { enabled: true, version_id: latest(targetForm).id, frequency: 'EVERY_VISIT', priority: 100, is_default: isDefault, opens_at: null, closes_at: null });
        else await surveyHubApi.connect({ form_id: targetForm.id, version_id: latest(targetForm).id, event, center_code: centerCode, notice_id: null, frequency: 'EVERY_VISIT', priority: 100, is_default: isDefault });
        await reload();
    };
    const copyPublicLink = async link => {
        const url = `${window.location.origin}/survey/${link.public_token}`;
        await navigator.clipboard.writeText(url);
        window.alert('설문 링크를 복사했습니다.');
    };
    return <div className="space-y-6 pb-12 animate-fade-in-up">
        <AdminPageHeader title="설문조사" subtitle="입실·퇴실·프로그램 설문을 만들고 적용하며 응답을 확인합니다" icon={<ClipboardList />} actions={<button className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold hover:bg-gray-50" onClick={onLegacy}>기존 설문·응답 보기</button>} />
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        {loading && <p>설문을 불러오는 중…</p>}
        {!ready && <div className="rounded-xl border bg-amber-50 p-5">설문 관리 기능을 불러오는 중입니다.</div>}
        {ready && !loading && <>
            {view === 'import' && <button onClick={() => { setView('list'); setEditor(null); }} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold hover:bg-gray-50"><ArrowLeft size={17} />설문 목록</button>}
            {view === 'list' && <>
                <div className="flex gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm" role="tablist" aria-label="설문 관리 구분"><button role="tab" aria-selected={sectionTab === 'SURVEYS'} onClick={() => { setSectionTab('SURVEYS'); setQuery(''); }} className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${sectionTab === 'SURVEYS' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>설문 <span className="ml-1 opacity-70">{reusableForms.length}</span></button><button role="tab" aria-selected={sectionTab === 'PROGRAMS'} onClick={() => { setSectionTab('PROGRAMS'); setQuery(''); }} className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${sectionTab === 'PROGRAMS' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>프로그램 <span className="ml-1 opacity-70">{programs.filter(program => (programFeedbackCounts[program.id] || 0) > 0 || hasProgramSurvey(program)).length}</span></button></div>
                <div className="flex flex-col justify-between gap-3 md:flex-row"><label className="relative flex-1 max-w-md"><Search className="absolute left-3 top-3 text-gray-400" size={18} /><input aria-label={sectionTab === 'SURVEYS' ? '설문 검색' : '프로그램 검색'} placeholder={sectionTab === 'SURVEYS' ? '설문 검색' : '프로그램 검색'} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500" value={query} onChange={e => setQuery(e.target.value)} /></label>{sectionTab === 'SURVEYS' && <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700" onClick={() => { setSelected(null); setEditor({}); setView('edit'); }}><Plus size={16} />새 설문</button>}</div>
                {sectionTab === 'SURVEYS' && <div className="overflow-hidden rounded-[24px] border border-[#f2f4f6] bg-white shadow-sm"><div className="hidden grid-cols-[minmax(220px,.8fr)_80px_70px_minmax(410px,1.5fr)_240px] gap-3 bg-gray-50 px-5 py-3 text-xs font-bold text-gray-500 md:grid"><span>설문</span><span>구분</span><span>응답</span><span>입실·퇴실 설정</span><span>관리</span></div>{visibleForms.map(f => { const visitLinks = links.filter(l => l.form_id === f.id && l.enabled && ['CHECKIN','CHECKOUT'].includes(l.event)); const publicLink = links.find(l => l.form_id === f.id && l.enabled && l.event === 'PUBLIC'); const types = f.kind === 'TEMPLATE' ? ['TEMPLATE'] : [...new Set([...visitLinks.map(l => l.event), ...(publicLink ? ['PUBLIC'] : [])])]; return <div key={f.id} role="button" tabIndex={0} onClick={() => execute(() => loadResults(f.id))} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); execute(() => loadResults(f.id)); } }} className="grid cursor-pointer items-center gap-3 border-t border-gray-100 px-5 py-4 transition-colors hover:bg-blue-50/40 focus:bg-blue-50 focus:outline-none md:grid-cols-[minmax(220px,.8fr)_80px_70px_minmax(410px,1.5fr)_240px]"><div><p className="font-bold text-gray-900">{latest(f)?.definition.title || f.title}{f.archived && <span className="ml-2 text-xs text-gray-400">보관됨</span>}</p><p className="mt-1 text-xs text-gray-400">{latest(f)?.definition.questions.length || 0}개 질문</p></div><div className="flex flex-wrap gap-1">{types.length ? types.map(type => <span key={type} className={`w-fit px-2 py-1 text-xs font-bold ${type === 'CHECKOUT' ? 'bg-emerald-50 text-emerald-700' : type === 'TEMPLATE' ? 'bg-violet-50 text-violet-700' : type === 'PUBLIC' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{type === 'CHECKIN' ? '입실' : type === 'CHECKOUT' ? '퇴실' : type === 'PUBLIC' ? '공유' : '템플릿'}</span>) : <span className="text-xs text-gray-400">미연결</span>}</div><span className="text-sm font-bold text-blue-600">{formEntryCounts[f.id] || 0}건</span><div onClick={event => event.stopPropagation()}><div className="grid grid-cols-2 gap-1.5">{SURVEY_CENTERS.flatMap(center => ['CHECKIN','CHECKOUT'].map(surveyEvent => { const active = links.find(link => link.enabled && link.form_id === f.id && link.center_code === center.code && link.event === surveyEvent); const state = active ? (active.is_default ? 'DEFAULT' : 'PRIMARY') : 'OFF'; return <label key={`${center.code}-${surveyEvent}`} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5"><span className="mb-1 block text-[11px] font-bold text-gray-500">{center.label} {surveyEvent === 'CHECKIN' ? '입실' : '퇴실'}</span><select aria-label={`${center.label} ${surveyEvent === 'CHECKIN' ? '입실' : '퇴실'} 연결`} disabled={busy || f.archived || f.kind === 'TEMPLATE'} value={state} onChange={event => execute(() => setVisitConnection(f, center.code, surveyEvent, event.target.value))} className={`w-full bg-transparent text-xs font-bold outline-none ${state === 'DEFAULT' ? 'text-violet-700' : state === 'PRIMARY' ? 'text-blue-700' : 'text-gray-400'} disabled:text-gray-300`}><option value="OFF">사용 안 함</option><option value="PRIMARY">일반 설문</option><option value="DEFAULT">기본 설문</option></select></label>; }))}</div></div><div className="flex flex-wrap gap-2"><button className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold hover:bg-gray-50" onClick={event => { event.stopPropagation(); setSelected(f.id); setEditor(latest(f)?.definition || {}); setView('edit'); }}>편집</button>{f.kind !== 'TEMPLATE' && (publicLink ? <><button title="공유 링크 복사" className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-700 hover:bg-amber-100" onClick={event => { event.stopPropagation(); copyPublicLink(publicLink); }}><Link2 size={15} /></button><button title="공유 중지" className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50" onClick={event => { event.stopPropagation(); execute(async () => { await surveyHubApi.updateLink(publicLink.id, { enabled: false }); await reload(); }); }}><Unlink size={15} /></button></> : <button className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold hover:bg-gray-50" onClick={event => { event.stopPropagation(); execute(async () => { const created = await surveyHubApi.createPublicLink(f); await reload(); await copyPublicLink(created); }); }}><Link2 size={14} />공유</button>)}<button title="복제" className="rounded-xl border border-gray-200 bg-white p-2 hover:bg-gray-50" onClick={event => { event.stopPropagation(); setSelected(null); setEditor({ ...latest(f)?.definition, legacySource: null, title: `${latest(f)?.definition.title || f.title} 복사본` }); setView('edit'); }}><Copy size={15} /></button><button className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold hover:bg-gray-50" disabled={busy} onClick={event => { event.stopPropagation(); execute(async () => { await surveyHubApi.archive(f.id, !f.archived); await reload(); }); }}>{f.archived ? '보관 해제' : '보관'}</button></div></div>; })}{!visibleForms.length && <p className="p-10 text-center text-sm text-gray-400">새 설문을 만들거나 기존 설문을 가져와 시작하세요.</p>}</div>}
                {sectionTab === 'PROGRAMS' && <div className="overflow-hidden rounded-[24px] border border-[#f2f4f6] bg-white shadow-sm"><div className="hidden grid-cols-[minmax(300px,1fr)_150px_100px_minmax(220px,300px)_170px] gap-3 bg-gray-50 px-5 py-3 text-xs font-bold text-gray-500 md:grid"><span>프로그램</span><span>구분</span><span>피드백</span><span>사용한 설문</span><span>관리</span></div>{feedbackPrograms.map(program => { const programLink = links.find(link => link.enabled && String(link.notice_id) === String(program.id)); const programForm = forms.find(item => item.id === programLink?.form_id); const surveyTitle = programLink?.version?.definition?.title || program.guest_properties?.custom_feedback_config?.title || '기존 프로그램 피드백'; return <div key={program.id} role="button" tabIndex={0} onClick={() => setLegacyProgram(program)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setLegacyProgram(program); } }} className="grid cursor-pointer items-center gap-3 border-t border-gray-100 px-5 py-4 transition-colors hover:bg-blue-50/40 focus:bg-blue-50 focus:outline-none md:grid-cols-[minmax(300px,1fr)_150px_100px_minmax(220px,300px)_170px]"><div><p className="font-bold text-gray-900">{program.title}</p><p className="mt-1 text-xs text-gray-400">{program.program_date ? new Date(program.program_date).toLocaleDateString('ko-KR') : '일정 미지정'}</p></div><span className="w-fit rounded-lg bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">{program.program_type || '프로그램'}</span><span className="text-sm font-bold text-blue-600">{programFeedbackCounts[program.id] || 0}건</span><span className="text-sm text-gray-600">{surveyTitle}</span><div className="flex gap-2"><button className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold hover:bg-gray-50" onClick={event => { event.stopPropagation(); setLegacyProgram(program); }}><Eye size={15} />결과</button>{programForm?.kind === 'PROGRAM' && <button className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold hover:bg-gray-50" onClick={event => { event.stopPropagation(); setSelected(programForm.id); setEditor(latest(programForm)?.definition || {}); setView('edit'); }}>편집</button>}</div></div>; })}{!feedbackPrograms.length && <p className="p-10 text-center text-sm text-gray-400">설문이나 피드백이 있는 프로그램이 없습니다.</p>}</div>}
            </>}
            {view === 'import' && <section className="rounded-2xl bg-white border p-5 space-y-3"><p>기존 질문을 새 설문으로 복사합니다. 원본 응답은 이 설문의 결과에서도 조회할 수 있으며 삭제하거나 옮기지 않습니다. 기존 연결은 유지됩니다. 가져온 후 필요한 곳에 연결해 주세요.</p>{(editor?.imports || []).map(s => <button key={s.id} className={`${input} block w-full text-left`} onClick={() => { setSelected(null); setEditor({ ...legacyDefinition(s.config, s.title), legacySource: { table: 'surveys', id: s.id } }); setView('edit'); }}>{s.title}</button>)}<h3 className="font-bold pt-3">프로그램 피드백</h3><button className={input} onClick={() => { setSelected(null); setEditor(defaultFeedback); setView('edit'); }}>기본 피드백 8문항</button>{programs.filter(p => p.guest_properties?.custom_feedback_config?.questions?.length).map(p => <button key={p.id} className={`${input} block w-full text-left`} onClick={() => { setSelected(null); setEditor({ ...legacyDefinition(p.guest_properties.custom_feedback_config, `${p.title} 피드백`), legacySource: { table: 'program_feedback', id: p.id } }); setView('edit'); }}>{p.title}</button>)}</section>}
            {view === 'edit' && <SurveyDefinitionEditor key={`${selected || 'new'}-${view}`} initial={editor?.questions ? editor : undefined} allowTemplate={!selected} busy={busy} onCancel={() => setView('list')} onSave={async (definition, options) => {
                setBusy(true);
                try {
                    const editedForm = selected ? forms.find(item => item.id === selected) : null;
                    const version = selected ? await surveyHubApi.publish(selected, definition) : await surveyHubApi.create(definition, options?.saveAsTemplate ? 'TEMPLATE' : 'SURVEY');
                    if (editedForm) {
                        for (const link of links.filter(item => item.form_id === editedForm.id && item.enabled)) await surveyHubApi.updateLink(link.id, { version_id: version.id });
                        for (const [linkId, policy] of Object.entries(options?.linkPolicies || {})) {
                            const target = links.find(link => link.id === linkId);
                            if (!target) continue;
                            if (policy.is_default) for (const other of links.filter(link => link.id !== linkId && link.enabled && link.center_code === target.center_code && link.event === target.event && link.is_default)) await surveyHubApi.updateLink(other.id, { is_default: false });
                            if (!policy.is_default) for (const other of links.filter(link => link.id !== linkId && link.enabled && link.center_code === target.center_code && link.event === target.event && !link.is_default)) await surveyHubApi.updateLink(other.id, { enabled: false });
                            await surveyHubApi.updateLink(linkId, { frequency: policy.frequency, is_default: !!policy.is_default });
                        }
                    }
                    await reload(); setSelected(null); setEditor(null); if (editedForm?.kind === 'PROGRAM') setSectionTab('PROGRAMS'); setView('list');
                }
                finally { setBusy(false); }
            }} />}
            {view === 'results' && form && <UnifiedSurveyResults form={form} entries={entries} formLinks={formLinks} label={label} filter={filter} setFilter={setFilter} versionFilter={versionFilter} setVersionFilter={setVersionFilter} showExcluded={showExcluded} setShowExcluded={setShowExcluded} busy={busy} onBack={() => { setView('list'); setSelected(null); }} onToggleExclude={entry => execute(async () => { const result = await supabase.from('survey_entries').update({ aggregation_excluded: !entry.aggregation_excluded }).eq('id', entry.id); if (result.error) throw result.error; setEntries(await loadResultEntries(selected)); })} />}
        </>}
        {legacyProgram && <AdminFeedbackListModal notice={legacyProgram} onClose={()=>setLegacyProgram(null)} />}
    </div>;
}
