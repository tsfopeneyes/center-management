import React, { useEffect, useRef, useState } from 'react';
import { ClipboardList, FilePlus2, LayoutTemplate, Pencil } from 'lucide-react';
import { surveyHubApi, missingSurveySchema } from '../../api/surveyHubApi';
import { newQuestion } from '../../utils/surveyModel';
import SurveyDefinitionEditor from './SurveyDefinitionEditor';

const latestVersion = form => [...(form.survey_versions || [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
const copyDefinition = definition => JSON.parse(JSON.stringify(definition));

export default function ProgramSurveyPicker({ formData, updateField }) {
    const [forms, setForms] = useState([]), [available, setAvailable] = useState(false), [error, setError] = useState('');
    const [templateId, setTemplateId] = useState(''), [editing, setEditing] = useState(null);
    const hydrated = useRef(false);
    const pendingTemplateId = useRef(undefined);
    useEffect(() => { if (!editing) pendingTemplateId.current = undefined; }, [editing]);
    useEffect(() => { surveyHubApi.catalog().then(rows => { setForms(rows); setAvailable(true); }).catch(loadError => { if (!missingSurveySchema(loadError)) setError(loadError.message); }); }, []);

    const versionId = formData.guest_properties?.survey_version_id || '';
    const selectedForm = forms.find(form => form.survey_versions?.some(version => version.id === versionId));
    const draft = formData._program_survey_definition || null;
    const templates = forms.filter(form => form.kind === 'TEMPLATE' && !form.archived && latestVersion(form));

    useEffect(() => {
        if (!available || hydrated.current || draft || !selectedForm) return;
        hydrated.current = true;
        const definition = copyDefinition(latestVersion(selectedForm).definition);
        updateField('_program_survey_definition', definition);
        if (selectedForm.kind === 'PROGRAM') {
            updateField('_program_survey_original_definition', copyDefinition(definition));
            updateField('_program_survey_form_id', selectedForm.id);
            updateField('_program_survey_template_id', selectedForm.source_template_id || null);
            updateField('_program_survey_original_template_id', selectedForm.source_template_id || null);
        } else {
            updateField('_program_survey_original_definition', null);
            updateField('_program_survey_form_id', null);
            updateField('_program_survey_template_id', null);
            updateField('_program_survey_original_template_id', null);
            updateField('guest_properties', { ...(formData.guest_properties || {}), survey_version_id: '' });
        }
    }, [available, draft, formData.guest_properties, selectedForm, updateField]);

    if (!available) return error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">설문 템플릿을 불러오지 못했습니다: {error}</p> : <p className="text-xs font-bold text-slate-400">설문 템플릿을 불러오는 중...</p>;

    const openTemplate = () => {
        const template = templates.find(form => form.id === templateId);
        if (!template) return;
        const definition = copyDefinition(latestVersion(template).definition);
        pendingTemplateId.current = template.id;
        setEditing({ ...definition, title: formData.title?.trim() ? `${formData.title.trim()} 피드백` : definition.title });
    };
    const openNew = () => {
        pendingTemplateId.current = null;
        setEditing({ title: formData.title?.trim() ? `${formData.title.trim()} 피드백` : '프로그램 피드백', description: '', questions: [newQuestion()] });
    };
    const applyDefinition = async definition => {
        updateField('_program_survey_definition', definition);
        updateField('_program_survey_template_id', pendingTemplateId.current === undefined ? (formData._program_survey_template_id || null) : pendingTemplateId.current);
        if (!formData._program_survey_form_id) updateField('guest_properties', { ...(formData.guest_properties || {}), survey_version_id: '' });
        setEditing(null);
    };

    return <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-white p-2 text-blue-600"><ClipboardList size={17} /></div><div><p className="text-xs font-bold text-slate-800">프로그램 설문</p><p className="mt-1 text-[11px] font-medium text-slate-500">템플릿의 질문을 불러오거나 이 프로그램만의 설문을 만드세요.</p></div></div>

        {draft && <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white p-4"><div><strong className="block text-sm text-slate-900">{draft.title}</strong><span className="mt-1 block text-xs font-medium text-slate-400">{draft.questions?.length || 0}개 질문 · 이 프로그램에 따로 저장{formData._program_survey_template_id ? ' · 템플릿 결과에 포함' : ''}</span></div><button type="button" onClick={() => setEditing(copyDefinition(draft))} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-gray-50"><Pencil size={14} />질문 편집</button></div>}

        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <select aria-label="설문 템플릿" value={templateId} onChange={event => setTemplateId(event.target.value)} className="min-w-0 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500">
                <option value="">설문 템플릿 선택</option>
                {templates.map(form => <option key={form.id} value={form.id}>{latestVersion(form).definition.title}</option>)}
            </select>
            <button type="button" disabled={!templateId} onClick={openTemplate} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 disabled:opacity-40"><LayoutTemplate size={16} />템플릿 불러오기</button>
            <button type="button" onClick={openNew} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"><FilePlus2 size={16} />새 설문 만들기</button>
        </div>
        {!templates.length && <p className="text-xs font-medium text-slate-500">저장된 템플릿이 없습니다. 새 설문을 만들거나 설문조사에서 템플릿을 저장해 주세요.</p>}

        <label className="flex cursor-pointer items-center justify-between rounded-xl bg-white p-3"><span><strong className="block text-xs text-slate-800">설문 제출 후 포인트 지급</strong><span className="mt-1 block text-[10px] font-medium text-slate-400">사용하면 설문을 완료한 뒤 프로그램 포인트가 지급됩니다.</span></span><input type="checkbox" checked={!!formData.is_review_required} onChange={event => updateField('is_review_required', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" /></label>

        {editing && <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/45 p-3 backdrop-blur-sm md:p-8" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}><div className="mx-auto max-w-5xl"><SurveyDefinitionEditor initial={editing} compact onCancel={() => setEditing(null)} onSave={applyDefinition} /></div></div>}
    </section>;
}
