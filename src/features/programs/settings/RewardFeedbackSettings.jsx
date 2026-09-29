import React from 'react';
import PropTypes from 'prop-types';
import { Gift, ToggleRight, ToggleLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { MAX_PROGRAM_HAIFN_REWARD } from '../../../components/admin/board/utils/constants';
import ProgramSurveyPicker from '../../../components/surveys/ProgramSurveyPicker';

const RewardFeedbackSettings = ({ formData, updateField }) => (
    <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
        (Number(formData.haifn_reward) > 0 || formData.enable_feedback) ? 'border-blue-300 shadow-md' : 'border-slate-200/80 hover:border-slate-300'
    }`}>
        <button
            type="button"
            onClick={() => {
                const isActive = Number(formData.haifn_reward) > 0 || formData.enable_feedback;
                if (isActive) {
                    updateField('haifn_reward', 0);
                    updateField('enable_feedback', false);
                    updateField('is_review_required', false);
                } else {
                    updateField('haifn_reward', MAX_PROGRAM_HAIFN_REWARD);
                    updateField('enable_feedback', true);
                }
            }}
            className="w-full p-4 sm:p-5 flex items-center justify-between bg-white hover:bg-slate-50/60 transition-colors cursor-pointer select-none"
        >
            <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl transition-colors ${
                    (Number(formData.haifn_reward) > 0 || formData.enable_feedback) ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                }`}>
                    <Gift size={18} />
                </div>
                <div className="flex flex-col items-start text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">지급 포인트 & 피드백 설정</span>
                        <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                            (Number(formData.haifn_reward) > 0 || formData.enable_feedback) ? 'bg-blue-50 text-blue-600 border-blue-200/60' : 'bg-slate-100 text-slate-500 border-slate-200/60'
                        }`}>
                            {Number(formData.haifn_reward) > 0 && formData.enable_feedback
                                ? `${formData.haifn_reward} HP 지급 & 피드백 수집`
                                : Number(formData.haifn_reward) > 0
                                    ? `${formData.haifn_reward} HP 지급 (설문 없음)`
                                    : formData.enable_feedback
                                        ? '피드백 수집 (포인트 없음)'
                                        : '미사용 (비활성화)'}
                        </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium mt-0.5">참여 학생에게 지급할 하이픈 포인트와 피드백 설문 수집 여부를 각각 설정합니다.</span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {(Number(formData.haifn_reward) > 0 || formData.enable_feedback) ? (
                    <ToggleRight size={28} className="text-blue-600" />
                ) : (
                    <ToggleLeft size={28} className="text-slate-300" />
                )}
                {(Number(formData.haifn_reward) > 0 || formData.enable_feedback) ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </div>
        </button>

        {(Number(formData.haifn_reward) > 0 || formData.enable_feedback) && (
            <div className="p-5 pt-3 border-t border-slate-100 bg-slate-50/40 space-y-5 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 포인트 설정 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 mb-1.5 block">지급 포인트 (HP)</label>
                        <div className="relative h-11 flex items-center bg-white border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 transition-all">
                            <Gift className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                            <input
                                type="number"
                                placeholder="단위: 하이픈 (지급 포인트)"
                                min="0"
                                max={MAX_PROGRAM_HAIFN_REWARD}
                                value={formData.haifn_reward ?? ''}
                                onChange={e => updateField(
                                    'haifn_reward',
                                    Math.min(MAX_PROGRAM_HAIFN_REWARD, Math.max(0, parseInt(e.target.value) || 0))
                                )}
                                className="w-full h-full pl-10 pr-3.5 bg-transparent outline-none font-bold text-slate-800 text-xs"
                            />
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mt-1.5 block leading-normal">프로그램 참여 완료 시 학생에게 부여할 포인트입니다. (최대 5H, 0 입력 시 미지급)</p>
                    </div>

                    {/* 피드백 설문 수집 여부 스위치 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 mb-1.5 block">종료 후 피드백 설문 수집</label>
                        <div
                            className={`flex items-start gap-3 p-3 border rounded-2xl cursor-pointer select-none transition-all duration-200 ${
                                formData.enable_feedback
                                    ? 'bg-blue-50/60 border-blue-400 text-blue-700'
                                    : 'bg-white border-slate-200/60 text-slate-500 hover:bg-slate-50'
                            }`}
                            onClick={() => {
                                const nextState = !formData.enable_feedback;
                                updateField('enable_feedback', nextState);
                                if (!nextState) updateField('is_review_required', false);
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={formData.enable_feedback || false}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer mt-0.5 shrink-0"
                            />
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800">피드백/만족도 설문 수집</span>
                                <span className="text-[10px] font-semibold text-slate-400 mt-0.5">체크 시 종료 후 출석한 학생에게 만족도 및 후기 설문을 받습니다.</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 피드백 설문 수집이 활성화된 경우만 노출되는 상세 질문 & 조건 설정 */}
                {formData.enable_feedback && <ProgramSurveyPicker formData={formData} updateField={updateField} />}
            </div>
        )}
    </div>
);

RewardFeedbackSettings.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
};

export default RewardFeedbackSettings;
