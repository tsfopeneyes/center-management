import React from 'react';
import PropTypes from 'prop-types';
import { Users, ChevronUp, ChevronDown, Sparkles, ToggleLeft, ToggleRight, Dices } from 'lucide-react';

const ApplicantExperienceSettings = ({ formData, updateField }) => (
        <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
            formData.enable_post_program_button ? 'border-blue-300 shadow-md' : 'border-slate-200/80 hover:border-slate-300'
        }`}>
            <button
                type="button"
                onClick={() => {
                    const nextState = !formData.enable_post_program_button;
                    updateField('enable_post_program_button', nextState);
                }}
                className="w-full p-4 sm:p-5 flex items-center justify-between bg-white hover:bg-slate-50/60 transition-colors cursor-pointer select-none"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl transition-colors ${
                        formData.enable_post_program_button ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                        <Sparkles size={18} />
                    </div>
                    <div className="flex flex-col items-start text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800">버튼 및 팝업 설정</span>
                            <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                                formData.enable_post_program_button ? 'bg-blue-50 text-blue-600 border-blue-200/60' : 'bg-slate-100 text-slate-500 border-slate-200/60'
                            }`}>
                                {formData.enable_post_program_button ? '사용 중' : '미사용'}
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium mt-0.5">종료 또는 시작 시점에 신청자에게 노출될 맞춤 버튼을 설정합니다.</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {formData.enable_post_program_button ? (
                        <ToggleRight size={28} className="text-blue-600" />
                    ) : (
                        <ToggleLeft size={28} className="text-slate-300" />
                    )}
                    {formData.enable_post_program_button ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
            </button>

            {formData.enable_post_program_button && (
                <div className="p-5 pt-3 border-t border-slate-100 bg-slate-50/40 space-y-4 animate-fade-in">
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        지정한 시점이 지난 후, 해당 프로그램을 신청했던 참가자들에게 노출될 맞춤 버튼 이름과 클릭 시 표시될 팝업 내용/링크를 작성할 수 있습니다.
                    </p>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 space-y-3">
                        <label className="text-[11px] font-bold text-slate-600 block">버튼 활성화 시점 선택</label>
                        <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-700">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="post_program_button_trigger"
                                    value="start_time"
                                    checked={(formData.post_program_button_trigger || 'start_time') === 'start_time'}
                                    onChange={e => updateField('post_program_button_trigger', e.target.value)}
                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>프로그램 시작 시간 기준</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="post_program_button_trigger"
                                    value="end_time"
                                    checked={formData.post_program_button_trigger === 'end_time'}
                                    onChange={e => updateField('post_program_button_trigger', e.target.value)}
                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>프로그램 종료/마감 시간 기준</span>
                            </label>
                        </div>

                        {/* 활성화 시간 사전 설정 (시작 시간 기준 선택 시) */}
                        {(formData.post_program_button_trigger || 'start_time') === 'start_time' && (
                            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700 animate-fade-in">
                                <span className="text-slate-500 font-semibold shrink-0">활성화 시기:</span>
                                <div className="flex items-center gap-1.5">
                                    <select
                                        value={formData.post_program_button_offset_minutes ?? 0}
                                        onChange={e => updateField('post_program_button_offset_minutes', Number(e.target.value))}
                                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-blue-600 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                                    >
                                        <option value={0}>정각 (시작 시간 정각)</option>
                                        <option value={5}>5분 전</option>
                                        <option value={10}>10분 전</option>
                                        <option value={15}>15분 전</option>
                                        <option value={20}>20분 전</option>
                                        <option value={30}>30분 전</option>
                                        <option value={45}>45분 전</option>
                                        <option value={60}>1시간 전</option>
                                        <option value={120}>2시간 전</option>
                                    </select>
                                    <span className="text-slate-600 font-medium">부터 버튼이 학생들에게 노출됩니다</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-600">버튼 이름 (선택)</label>
                                <span className="text-[10px] font-semibold text-blue-600">
                                    {(() => {
                                        if (formData.post_program_button_name?.trim()) return '직접 입력한 이름 사용';
                                        const hasGroup = formData.enable_group_assignment;
                                        const hasQ = formData.enable_random_questions && formData.random_questions?.length > 0;
                                        if (hasGroup && hasQ) return '자동 설정: "팀 확인 및 나눔 질문"';
                                        if (hasGroup) return '자동 설정: "팀 확인하기"';
                                        if (hasQ) return '자동 설정: "아이스브레이킹 질문"';
                                        return '미입력 시 "프로그램 안내"로 노출';
                                    })()}
                                </span>
                            </div>
                            <input
                                type="text"
                                value={formData.post_program_button_name || ''}
                                onChange={e => updateField('post_program_button_name', e.target.value)}
                                placeholder="비워두면 하단에서 선택한 기능(조 배치, 질문 등)에 맞게 자동 명명됩니다."
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200/60 rounded-xl outline-none font-bold text-slate-800 text-xs focus:border-blue-600 transition-all placeholder:text-slate-400"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">버튼 클릭 시 나타날 팝업 내용</label>
                            <textarea
                                value={formData.post_program_button_content || ''}
                                onChange={e => updateField('post_program_button_content', e.target.value)}
                                placeholder="버튼을 눌렀을 때 학생들에게 전달할 안내 문구나 메시지를 입력하세요."
                                rows={3}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200/60 rounded-xl outline-none font-bold text-slate-800 text-xs focus:border-blue-600 transition-all resize-none placeholder:text-slate-400"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">연결할 외부 링크 (옵션)</label>
                            <input
                                type="text"
                                value={formData.post_program_button_link || ''}
                                onChange={e => updateField('post_program_button_link', e.target.value)}
                                placeholder="예: https://forms.google.com/... (링크 입력 시 팝업 창에 바로가기 버튼이 노출됩니다)"
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200/60 rounded-xl outline-none font-bold text-slate-800 text-xs focus:border-blue-600 transition-all placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    {/* 조 배치 설정 카드 */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200/60 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users size={16} className="text-blue-600" />
                                <span className="text-xs font-bold text-slate-800">랜덤 팀 배치</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => updateField('enable_group_assignment', !formData.enable_group_assignment)}
                                className="cursor-pointer"
                            >
                                {formData.enable_group_assignment ? (
                                    <ToggleRight size={24} className="text-blue-600" />
                                ) : (
                                    <ToggleLeft size={24} className="text-slate-300" />
                                )}
                            </button>
                        </div>

                        {formData.enable_group_assignment && (
                            <div className="pt-2 border-t border-slate-100 space-y-2.5 animate-fade-in">
                                <p className="text-[11px] text-slate-400 font-medium">
                                    신청자들이 팝업을 열었을 때 본인의 조 배치 정보(예: 2조)를 확인할 수 있도록 안내합니다.
                                </p>
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-bold text-slate-600 shrink-0">총 조 개수 설정:</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={formData.group_count || 4}
                                        onChange={e => updateField('group_count', parseInt(e.target.value) || 1)}
                                        className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-lg outline-none font-bold text-slate-800 text-xs focus:border-blue-600"
                                    />
                                    <span className="text-xs font-bold text-slate-500">개 조 (무작위 랜덤 균등 자동 배치됩니다)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 랜덤 질문 설정 카드 */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200/60 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Dices size={16} className="text-blue-600" />
                                <span className="text-xs font-bold text-slate-800">랜덤 질문</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => updateField('enable_random_questions', !formData.enable_random_questions)}
                                className="cursor-pointer"
                            >
                                {formData.enable_random_questions ? (
                                    <ToggleRight size={24} className="text-blue-600" />
                                ) : (
                                    <ToggleLeft size={24} className="text-slate-300" />
                                )}
                            </button>
                        </div>

                        {formData.enable_random_questions && (
                            <div className="pt-2 border-t border-slate-100 space-y-3 animate-fade-in">
                                <p className="text-[11px] text-slate-400 font-medium">
                                    팝업 모달에 '🎲 다른 질문 뽑기' 버튼이 노출되며 아래 등록한 질문들이 무작위로 나타납니다.
                                </p>

                                {/* 질문 목록 */}
                                <div className="space-y-2">
                                    {(formData.random_questions || []).map((q, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200/40">
                                            <span className="text-xs font-bold text-blue-600 shrink-0 w-6 text-center">Q{idx + 1}.</span>
                                            <input
                                                type="text"
                                                value={q}
                                                onChange={e => {
                                                    const updated = [...(formData.random_questions || [])];
                                                    updated[idx] = e.target.value;
                                                    updateField('random_questions', updated);
                                                }}
                                                placeholder="신규 질문을 입력하세요"
                                                className="w-full bg-transparent outline-none text-xs font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = (formData.random_questions || []).filter((_, i) => i !== idx);
                                                    updateField('random_questions', updated);
                                                }}
                                                className="text-[10px] font-black text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors shrink-0"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* 질문 추가 버튼 */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const updated = [...(formData.random_questions || []), ''];
                                        updateField('random_questions', updated);
                                    }}
                                    className="w-full py-2 bg-slate-50 hover:bg-blue-50/20 border border-dashed border-slate-200 hover:border-blue-400 rounded-xl font-bold text-slate-500 hover:text-blue-600 transition-all text-xs flex items-center justify-center gap-1"
                                >
                                    + 질문 추가하기
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
);

ApplicantExperienceSettings.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired
};

export default React.memo(ApplicantExperienceSettings);
