import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getProgramButtons, getProgramButtonLabel, normalizeProgramButton, buttonHasTeams, buttonHasQuestions } from '../programButtons';

const fieldClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600';
const templates = [['GUIDE', '직접 작성 (기본형)'], ['TEAM', '팀 배치 안내'], ['QUESTIONS', '나눔 질문']];

function ButtonEditor({ button, index, total, onChange, onRemove, onMove }) {
    const [open, setOpen] = useState(true);
    const set = (key, value) => onChange({ ...button, [key]: value });
    const team = buttonHasTeams(button), questions = buttonHasQuestions(button);
    const customContent = button.template === 'GUIDE';
    const id = `program-button-${button.id}`;
    return <section className="overflow-hidden rounded-xl border border-slate-200" aria-label={`버튼 ${index + 1} 설정`}>
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-3">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={`${id}-settings`}
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-bold text-slate-800">
                <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                <span className="break-words">{index + 1}. {getProgramButtonLabel(button)}</span>
            </button>
            <button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`버튼 ${index + 1} 위로 이동`} className="rounded p-2 text-slate-600 hover:bg-slate-200 disabled:opacity-30"><ChevronUp size={16} /></button>
            <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} aria-label={`버튼 ${index + 1} 아래로 이동`} className="rounded p-2 text-slate-600 hover:bg-slate-200 disabled:opacity-30"><ChevronDown size={16} /></button>
            <button type="button" onClick={onRemove} aria-label={`버튼 ${index + 1} 삭제`} className="rounded p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
        </div>
        {open && <div id={`${id}-settings`} className="space-y-5 p-4 sm:p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={button.enabled} onChange={event => set('enabled', event.target.checked)} className="h-4 w-4 rounded text-blue-600" />이 버튼 사용
            </label>
            <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-800">버튼 유형</p>
                <div className="flex flex-wrap gap-2">
                    {[...templates, ...(button.template === 'TEAM_QUESTIONS' ? [['TEAM_QUESTIONS', '팀 배치·나눔 질문 (기존)']] : [])].map(([value, label]) => <button key={value} type="button" aria-pressed={button.template === value} onClick={() => set('template', value)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${button.template === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700'}`}>{label}</button>)}
                </div>
                <p className="text-xs leading-relaxed text-slate-600">기본형은 내용을 직접 작성합니다. 템플릿을 선택하면 해당 기능의 설정으로 바뀝니다.</p>
            </div>
            <label className="block text-sm font-semibold text-slate-700">버튼 이름
                <input type="text" value={button.name} onChange={event => set('name', event.target.value)} placeholder={getProgramButtonLabel({ ...button, name: '' })} className={fieldClass} />
            </label>
            {customContent && <>
            <label className="block text-sm font-semibold text-slate-700">버튼을 누르면 보일 내용
                <textarea value={button.content} onChange={event => set('content', event.target.value)} rows={6}
                    placeholder="기도문, 안내문 등 원하는 내용을 자유롭게 작성하세요. 줄바꿈도 그대로 표시됩니다." className={fieldClass} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">연결할 링크 (선택)
                <input type="url" value={button.link} onChange={event => set('link', event.target.value)} placeholder="https://example.com" className={fieldClass} />
            </label>
            </>}
                {team && <label className="block max-w-xs text-sm font-semibold text-slate-700">팀 개수<input type="number" min="1" max="50" value={button.group_count} onChange={event => set('group_count', Math.min(50, Math.max(1, Math.floor(Number(event.target.value) || 1))))} className={fieldClass} /></label>}
            {questions && <div className="space-y-4">
                <fieldset className="space-y-2">
                    <legend className="mb-2 text-sm font-semibold text-slate-800">학생 화면 표시 방식</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {[['LIST', '전체 질문 보기'], ['RANDOM', '랜덤 질문 한 개']].map(([value, label]) => <label key={value}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold ${button.question_display_mode === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-700'}`}>
                            <input type="radio" name={`${id}-question-display`} value={value} checked={button.question_display_mode === value}
                                onChange={() => set('question_display_mode', value)} className="h-4 w-4 text-blue-600" />{label}
                        </label>)}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">{button.question_display_mode === 'RANDOM'
                        ? '학생이 팝업을 열 때마다 질문 한 개와 해당 설명을 무작위로 보여줍니다.'
                        : '모든 질문과 설명을 순서대로 보여줍니다.'}</p>
                </fieldset>
                {button.questions.map((question, questionIndex) => <div key={questionIndex} className="space-y-3 border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-bold text-slate-800">질문 {questionIndex + 1}</h4>
                        <button type="button" onClick={() => set('questions', button.questions.filter((_, i) => i !== questionIndex))} aria-label={`버튼 ${index + 1} 질문 ${questionIndex + 1} 삭제`} className="rounded p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                    </div>
                    <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-question-${questionIndex}`}>질문
                        <textarea id={`${id}-question-${questionIndex}`} rows={2} value={question.question}
                            aria-label={`질문 ${questionIndex + 1}`} placeholder="예: 요즘 학교에서 어떻게 지내?"
                            onChange={event => set('questions', button.questions.map((item, i) => i === questionIndex ? { ...item, question: event.target.value } : item))}
                            className={fieldClass} />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-description-${questionIndex}`}>설명 (선택)
                        <textarea id={`${id}-description-${questionIndex}`} rows={3} value={question.description}
                            aria-label={`질문 ${questionIndex + 1} 설명`} placeholder="예: 가장 인상 깊었던 하루, 힘들었던 하루, 소소한 행복을 느꼈던 하루 등 편하게 나눠보자."
                            onChange={event => set('questions', button.questions.map((item, i) => i === questionIndex ? { ...item, description: event.target.value } : item))}
                            className={fieldClass} />
                    </label>
                </div>)}
                <button type="button" onClick={() => set('questions', [...button.questions, { question: '', description: '' }])} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">질문 추가</button>
            </div>}
            <div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">표시 시점
                    <select value={button.trigger} onChange={event => set('trigger', event.target.value)} className={fieldClass}>
                        <option value="start_time">프로그램 시작 기준</option><option value="end_time">프로그램 종료 후</option>
                    </select>
                </label>
                {button.trigger === 'start_time' && <label className="block text-sm font-semibold text-slate-700">시작 몇 분 전부터 표시할까요?
                    <select value={button.offset_minutes} onChange={event => set('offset_minutes', Number(event.target.value))} className={fieldClass}>
                        {[...new Set([0, 5, 10, 15, 20, 30, 45, 60, 120, button.offset_minutes])].sort((a, b) => a - b).map(minutes => <option key={minutes} value={minutes}>{minutes === 0 ? '시작 시각부터' : `${minutes}분 전`}</option>)}
                    </select>
                </label>}
            </div>
            <p className="text-xs leading-relaxed text-slate-600">선택한 버튼 유형에 맞는 화면이 참가자에게 표시됩니다.</p>
        </div>}
    </section>;
}

const ApplicantExperienceSettings = ({ formData, updateField }) => {
    const buttons = getProgramButtons(formData);
    const save = next => updateField('program_buttons', next);
    return <div className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-600">버튼마다 이름과 표시 시점을 정하고, 내용을 직접 작성하거나 팀 배치·나눔 질문 템플릿을 선택하세요.</p>
        {buttons.length === 0 && <p className="rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-600">아직 만든 버튼이 없습니다. 버튼을 추가해 원하는 내용을 작성하세요.</p>}
        {buttons.map((button, index) => <ButtonEditor key={button.id} button={button} index={index} total={buttons.length}
            onChange={next => save(buttons.map((item, i) => i === index ? next : item))}
            onRemove={() => save(buttons.filter((_, i) => i !== index))}
            onMove={direction => { const next = [...buttons]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; save(next); }} />)}
        <button type="button" onClick={() => save([...buttons, normalizeProgramButton({ id: uuidv4() })])}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100"><Plus size={18} />버튼 추가</button>
    </div>;
};
ApplicantExperienceSettings.propTypes = { formData: PropTypes.object.isRequired, updateField: PropTypes.func.isRequired };
export default React.memo(ApplicantExperienceSettings);
