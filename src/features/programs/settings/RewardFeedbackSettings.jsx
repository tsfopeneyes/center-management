import React from 'react';
import PropTypes from 'prop-types';
import { MAX_PROGRAM_HAIFN_REWARD } from '../../../components/admin/board/utils/constants';
import ProgramSurveyPicker from '../../../components/surveys/ProgramSurveyPicker';

const RewardFeedbackSettings = ({ formData, updateField }) => (
    <div className="space-y-6">
        <section className="space-y-3">
            <div>
                <h4 className="text-sm font-bold text-slate-800">참여 포인트</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">참여 완료 시 지급합니다. 0을 입력하면 지급하지 않습니다.</p>
            </div>
            <label className="block max-w-xs text-sm font-semibold text-slate-700">
                지급 포인트 (H)
                <input type="number" min="0" max={MAX_PROGRAM_HAIFN_REWARD}
                    value={formData.haifn_reward ?? 0}
                    onChange={event => {
                        const value = Math.min(MAX_PROGRAM_HAIFN_REWARD, Math.max(0, Number(event.target.value) || 0));
                        updateField('haifn_reward', value);
                        if (value === 0) updateField('is_review_required', false);
                    }}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </label>
            <p className="text-xs text-slate-600">최대 {MAX_PROGRAM_HAIFN_REWARD}H</p>
        </section>

        <section className="space-y-4 border-t border-slate-200 pt-5">
            <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={formData.enable_feedback === true}
                    onChange={event => {
                        updateField('enable_feedback', event.target.checked);
                        if (!event.target.checked) updateField('is_review_required', false);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span>
                    <span className="block text-sm font-bold text-slate-800">피드백 설문 받기</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-600">참여를 마친 학생에게 설문을 보여줍니다. 포인트 설정과 별개로 사용할 수 있습니다.</span>
                </span>
            </label>
            {formData.enable_feedback && <ProgramSurveyPicker formData={formData} updateField={updateField} />}
        </section>
    </div>
);

RewardFeedbackSettings.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
};

export default RewardFeedbackSettings;
