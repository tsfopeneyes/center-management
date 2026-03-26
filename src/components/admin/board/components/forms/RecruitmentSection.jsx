import React from 'react';
import PropTypes from 'prop-types';
import IntuitiveTimePicker from '../../../../common/IntuitiveTimePicker';
import { splitDateTime, joinDateTime } from '../../utils/noticeHelpers';
import { CATEGORIES } from '../../utils/constants';

const RecruitmentSection = ({ formData, updateField, mode }) => {
    if (!formData.is_recruiting) return null;

    return (
        <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4 animate-fade-in">
            <p className="text-xs font-bold text-blue-600 ml-1">신청 및 인원 설정</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase">신청 마감 일자</label>
                    <input
                        type="date"
                        value={splitDateTime(formData.recruitment_deadline).date}
                        onChange={e => {
                            const newDate = joinDateTime(e.target.value, splitDateTime(formData.recruitment_deadline).time);
                            updateField('recruitment_deadline', newDate);
                        }}
                        className="w-full h-[46px] p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm shadow-sm"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase">마감 시간</label>
                    <IntuitiveTimePicker
                        value={splitDateTime(formData.recruitment_deadline).time}
                        onChange={time => {
                            const newDate = joinDateTime(splitDateTime(formData.recruitment_deadline).date, time);
                            updateField('recruitment_deadline', newDate);
                        }}
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase">
                        모집 인원 (0: 무제한) {mode === CATEGORIES.PROGRAM && '*'}
                    </label>
                    <input
                        type="number"
                        placeholder="예: 10"
                        value={formData.max_capacity}
                        onChange={e => updateField('max_capacity', e.target.value)}
                        className="w-full h-[46px] p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm shadow-sm"
                        required={mode === CATEGORIES.PROGRAM}
                    />
                </div>
            </div>
        </div>
    );
};

RecruitmentSection.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
    mode: PropTypes.string.isRequired
};

export default React.memo(RecruitmentSection);
