import React from 'react';
import PropTypes from 'prop-types';
import { getParticipantButtonLabel, hasParticipantExtraScreen } from '../participantExperience';

const ApplicantExperienceSettings = ({ formData, updateField }) => {
    const enabled = formData.enable_post_program_button === true;
    const hasVisibleButton = hasParticipantExtraScreen(formData);
    const questions = formData.random_questions || [];
    const updateQuestion = (index, value) => updateField('random_questions',
        questions.map((question, itemIndex) => itemIndex === index ? value : question));

    return (
        <div className="space-y-6">
            <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={enabled}
                    onChange={event => updateField('enable_post_program_button', event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span>
                    <span className="block text-sm font-bold text-slate-800">참가자 추가 화면 사용</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-600">신청자에게 지정한 시점부터 안내 버튼을 보여줍니다.</span>
                </span>
            </label>

            {enabled && <>
                <section className="space-y-3 border-t border-slate-200 pt-5">
                    <h4 className="text-sm font-bold text-slate-800">언제 보여줄까요?</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {[['start_time', '시작 시점 기준'], ['end_time', '종료 시점 기준']].map(([value, label]) => (
                            <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700">
                                <input type="radio" name="post_program_button_trigger" value={value}
                                    checked={(formData.post_program_button_trigger || 'start_time') === value}
                                    onChange={() => updateField('post_program_button_trigger', value)}
                                    className="h-4 w-4 text-blue-600" />{label}
                            </label>
                        ))}
                    </div>
                    {(formData.post_program_button_trigger || 'start_time') === 'start_time' && (
                        <label className="block max-w-sm text-sm font-semibold text-slate-700">
                            시작 몇 분 전부터 표시할까요?
                            <select value={formData.post_program_button_offset_minutes ?? 0}
                                onChange={event => updateField('post_program_button_offset_minutes', Number(event.target.value))}
                                className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800">
                                {[[0, '시작 시각부터'], [5, '5분 전'], [10, '10분 전'], [15, '15분 전'], [20, '20분 전'], [30, '30분 전'], [45, '45분 전'], [60, '1시간 전'], [120, '2시간 전']].map(([minutes, label]) => (
                                    <option key={minutes} value={minutes}>{label}</option>
                                ))}
                            </select>
                        </label>
                    )}
                </section>

                <section className="space-y-4 border-t border-slate-200 pt-5">
                    <div>
                        <h4 className="text-sm font-bold text-slate-800">버튼과 안내 내용</h4>
                        <p className="mt-1 text-xs text-slate-600">버튼 이름을 비우면 선택한 기능에 맞게 이름을 표시합니다.</p>
                    </div>
                    <label className="block text-sm font-semibold text-slate-700">
                        버튼 이름
                        <input type="text" value={formData.post_program_button_name || ''}
                            onChange={event => updateField('post_program_button_name', event.target.value)}
                            placeholder={getParticipantButtonLabel({ ...formData, post_program_button_name: '' })}
                            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-500" />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                        버튼을 누르면 보일 안내
                        <textarea value={formData.post_program_button_content || ''}
                            onChange={event => updateField('post_program_button_content', event.target.value)}
                            rows={3} placeholder="참가자에게 전할 안내를 입력하세요."
                            className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-500" />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                        연결할 링크 (선택)
                        <input type="url" value={formData.post_program_button_link || ''}
                            onChange={event => updateField('post_program_button_link', event.target.value)}
                            placeholder="https://example.com"
                            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-500" />
                    </label>
                </section>

                <section className="space-y-4 border-t border-slate-200 pt-5">
                    <div>
                        <h4 className="text-sm font-bold text-slate-800">화면에 함께 보여줄 기능</h4>
                        <p className="mt-1 text-xs text-slate-600">필요한 기능만 선택하세요.</p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-800">
                        <input type="checkbox" checked={formData.enable_group_assignment === true}
                            onChange={event => updateField('enable_group_assignment', event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600" />팀 배치 안내
                    </label>
                    {formData.enable_group_assignment && (
                        <label className="block max-w-xs text-sm text-slate-700">
                            팀 개수
                            <input type="number" min="1" max="50" value={formData.group_count || 4}
                                onChange={event => updateField('group_count', Math.min(50, Math.max(1, Number(event.target.value) || 1)))}
                                className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" />
                        </label>
                    )}
                    <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-800">
                        <input type="checkbox" checked={formData.enable_random_questions === true}
                            onChange={event => updateField('enable_random_questions', event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600" />나눔 질문
                    </label>
                    {formData.enable_random_questions && (
                        <div className="space-y-2">
                            {questions.map((question, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <label htmlFor={`program-question-${index}`} className="shrink-0 text-sm text-slate-600">질문 {index + 1}</label>
                                    <input id={`program-question-${index}`} type="text" value={question}
                                        onChange={event => updateQuestion(index, event.target.value)}
                                        className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800" />
                                    <button type="button" onClick={() => updateField('random_questions', questions.filter((_, itemIndex) => itemIndex !== index))}
                                        aria-label={`질문 ${index + 1} 삭제`}
                                        className="rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>
                                </div>
                            ))}
                            <button type="button" onClick={() => updateField('random_questions', [...questions, ''])}
                                className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">질문 추가</button>
                        </div>
                    )}
                </section>

                <aside className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                    <p className="text-xs font-semibold text-blue-700">참가자 화면 표시 상태</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">{hasVisibleButton ? getParticipantButtonLabel(formData) : '아직 표시되지 않음'}</p>
                    {!hasVisibleButton && <p className="mt-2 text-xs text-slate-600">버튼 이름, 안내 내용, 링크 또는 함께 보여줄 기능을 설정하면 버튼이 나타납니다.</p>}
                    {hasVisibleButton && (formData.post_program_button_content || formData.post_program_button_link) && (
                        <p className="mt-2 text-xs text-slate-600">버튼을 누르면 안내{formData.post_program_button_link ? '와 연결 링크' : ''}가 표시됩니다.</p>
                    )}
                </aside>
            </>}
        </div>
    );
};

ApplicantExperienceSettings.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
};

export default React.memo(ApplicantExperienceSettings);
