import React from 'react';
import PropTypes from 'prop-types';
import { ChevronUp, ChevronDown, Trash } from 'lucide-react';
import { createDailySessionField, MAX_DAILY_SESSION_FIELDS } from '../../../utils/dailyProgramSessions';

const ProgramParticipationSettings = ({ formData, updateField }) => (
    <>
        <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2 ml-1 block">운영 방식</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Open Program Card */}
                <button
                    type="button"
                    onClick={() => {
                        updateField('is_challenge', false);
                        updateField('is_recruiting', false);
                        updateField('max_capacity', '');
                    }}
                    className={`p-4 rounded-2xl text-left border-2 transition-all duration-200 flex items-start gap-3 ${
                        (formData.is_recruiting === false && !formData.is_challenge)
                            ? 'border-blue-600 bg-blue-50/10 shadow-[0_4px_12px_rgba(49,130,246,0.03)]'
                            : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                >
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        (formData.is_recruiting === false && !formData.is_challenge) ? 'border-blue-600' : 'border-slate-300'
                    }`}>
                        {(formData.is_recruiting === false && !formData.is_challenge) && (
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        )}
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800">오픈 프로그램</p>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">별도의 신청 절차 없이 모든 학생이 자유롭게 참여할 수 있습니다.</p>
                    </div>
                </button>

                {/* Recruiting Program Card */}
                <button
                    type="button"
                    onClick={() => {
                        updateField('is_challenge', false);
                        updateField('is_recruiting', true);
                    }}
                    className={`p-4 rounded-2xl text-left border-2 transition-all duration-200 flex items-start gap-3 ${
                        (formData.is_recruiting === true && !formData.is_challenge)
                            ? 'border-blue-600 bg-blue-50/10 shadow-[0_4px_12px_rgba(49,130,246,0.03)]'
                            : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                >
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        (formData.is_recruiting === true && !formData.is_challenge) ? 'border-blue-600' : 'border-slate-300'
                    }`}>
                        {(formData.is_recruiting === true && !formData.is_challenge) && (
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        )}
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800">신청 프로그램</p>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">선착순 마감 등 사전 신청을 하고 승인받은 학생만 참여합니다.</p>
                    </div>
                </button>

                {/* Challenge Program Card */}
                <button
                    type="button"
                    onClick={() => {
                        updateField('is_challenge', true);
                        updateField('is_recruiting', true);
                        updateField('max_capacity', '');
                    }}
                    className={`p-4 rounded-2xl text-left border-2 transition-all duration-200 flex items-start gap-3 ${
                        formData.is_challenge === true
                            ? 'border-blue-600 bg-blue-50/10 shadow-[0_4px_12px_rgba(49,130,246,0.03)]'
                            : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                >
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        formData.is_challenge === true ? 'border-blue-600' : 'border-slate-300'
                    }`}>
                        {formData.is_challenge === true && (
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        )}
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800">챌린지 프로그램</p>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">지정된 기간 동안 학생들이 미션을 수행하고 보상을 획득합니다.</p>
                    </div>
                </button>
            </div>
        </div>

        {!formData.is_challenge && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-4">
                <div>
                    <p className="text-sm font-black text-slate-800">진행 횟수</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {[['SINGLE', '한 번'], ['RECURRING', '여러 번']].map(([value, label]) => (
                            <button key={value} type="button" onClick={() => updateField('schedule_mode', value)} className={`rounded-xl border px-4 py-3 text-sm font-bold ${formData.schedule_mode === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}>{label}</button>
                        ))}
                    </div>
                </div>
                {formData.is_recruiting && formData.schedule_mode === 'RECURRING' && (
                    <div className="border-t border-slate-100 pt-4">
                        <p className="text-sm font-black text-slate-800">신청 방법</p>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[['PROGRAM', '한 번 신청하면 전체 참여'], ['SESSION', '참여할 회차마다 신청']].map(([value, label]) => (
                                <button key={value} type="button" onClick={() => updateField('application_scope', value)} className={`rounded-xl border px-4 py-3 text-left text-sm font-bold ${formData.application_scope === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}>{label}</button>
                            ))}
                        </div>
                        {formData.application_scope === 'SESSION' && (
                            <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-black text-slate-700">회차별 안내 항목</p>
                                        <p className="mt-0.5 text-[11px] font-medium text-slate-500">신청을 열 때 회차마다 입력할 내용을 정합니다. 필요 없으면 모두 삭제해도 됩니다.</p>
                                    </div>
                                    <span className="shrink-0 text-[11px] font-bold text-slate-400">최대 {MAX_DAILY_SESSION_FIELDS}개</span>
                                </div>
                                {(formData.daily_session_fields || []).length > 0 ? (
                                    <div className="space-y-2">
                                        {(formData.daily_session_fields || []).map((field, index, fields) => (
                                            <div key={field.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
                                                <input
                                                    value={field.label || ''}
                                                    onChange={event => updateField('daily_session_fields', fields.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))}
                                                    placeholder={index === 0 ? '예: 오늘의 안내' : '예: 준비물 또는 오늘의 메뉴'}
                                                    aria-label={`회차 항목 ${index + 1} 이름`}
                                                    className="h-9 min-w-0 flex-1 rounded-lg bg-slate-50 px-3 text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                                <label className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-slate-600">
                                                    <input type="checkbox" checked={field.required !== false} onChange={event => updateField('daily_session_fields', fields.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.checked } : item))} className="h-4 w-4 rounded border-slate-300 text-blue-600" />필수
                                                </label>
                                                <div className="flex shrink-0 items-center">
                                                    <button type="button" disabled={index === 0} onClick={() => { const next = [...fields]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; updateField('daily_session_fields', next); }} aria-label="위로 이동" className="rounded-md p-1 text-slate-400 disabled:opacity-25"><ChevronUp size={15}/></button>
                                                    <button type="button" disabled={index === fields.length - 1} onClick={() => { const next = [...fields]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; updateField('daily_session_fields', next); }} aria-label="아래로 이동" className="rounded-md p-1 text-slate-400 disabled:opacity-25"><ChevronDown size={15}/></button>
                                                    <button type="button" onClick={() => updateField('daily_session_fields', fields.filter((_, itemIndex) => itemIndex !== index))} aria-label="항목 삭제" className="rounded-md p-1 text-red-400"><Trash size={15}/></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="rounded-xl border border-dashed border-slate-200 bg-white py-4 text-center text-[11px] font-semibold text-slate-400">회차를 열 때 별도 안내를 입력하지 않습니다.</p>
                                )}
                                {(formData.daily_session_fields || []).length < MAX_DAILY_SESSION_FIELDS && (
                                    <button type="button" onClick={() => updateField('daily_session_fields', [...(formData.daily_session_fields || []), createDailySessionField((formData.daily_session_fields || []).length)])} className="w-full rounded-xl border border-dashed border-blue-200 bg-white py-2.5 text-xs font-black text-blue-600">+ 안내 항목 추가</button>
                                )}
                                <p className="text-[11px] font-semibold text-slate-500">관리자가 다음 회차의 신청을 열면 그때만 학생 화면에 표시됩니다.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

        {formData.is_challenge && (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-3">
                <div><p className="text-sm font-black text-slate-800">챌린지 참여 방식</p><p className="text-xs font-semibold text-slate-400 mt-1">참여 장소에 따라 필요한 설정을 구분합니다.</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button type="button" onClick={() => {
                        if (formData.challenge_format !== 'ONLINE') updateField('challenge_missions', []);
                        updateField('challenge_format', 'ONLINE');
                    }} className={`p-4 rounded-2xl border-2 text-left ${formData.challenge_format === 'ONLINE' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                        <p className="text-sm font-black text-slate-800">온라인 챌린지</p><p className="mt-1 text-xs text-slate-500">기간 안에 어디서든 커뮤니티로 참여</p>
                    </button>
                    <button type="button" onClick={() => {
                        if (formData.challenge_format === 'ONLINE') updateField('challenge_missions', []);
                        updateField('challenge_format', 'OFFLINE');
                        updateField('community_enabled', false);
                    }} className={`p-4 rounded-2xl border-2 text-left ${(formData.challenge_format || 'OFFLINE') === 'OFFLINE' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                        <p className="text-sm font-black text-slate-800">오프라인 챌린지</p><p className="mt-1 text-xs text-slate-500">정해진 장소에서 미션 수행 후 인증</p>
                    </button>
                </div>
            </div>
        )}
    </>
);

ProgramParticipationSettings.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired
};

export default React.memo(ProgramParticipationSettings);
