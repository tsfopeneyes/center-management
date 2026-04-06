import React from 'react';
import PropTypes from 'prop-types';
import IntuitiveTimePicker from '../../../../common/IntuitiveTimePicker';
import { splitDateTime, joinDateTime } from '../../utils/noticeHelpers';
import { CATEGORIES } from '../../utils/constants';
import { Calendar, Clock, Users } from 'lucide-react';

const RecruitmentSection = ({ formData, updateField, mode }) => {
    if (!formData.is_recruiting) return null;

    return (
        <div className="space-y-2 animate-fade-in">
            <div className="flex items-center gap-2 mt-4 ml-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                <h4 className="text-xs font-bold text-blue-600 tracking-wide uppercase">신청 및 인원 설정</h4>
            </div>
            <div className="border border-blue-200 rounded-2xl bg-white overflow-hidden focus-within:border-blue-500 transition-colors shadow-sm">
                
                {/* Row 1: Deadline Date & Time */}
                <div className="flex flex-col sm:flex-row border-b border-gray-200">
                    <div className="relative flex-1 border-b sm:border-b-0 sm:border-r border-gray-200 flex items-center">
                        <Calendar className="absolute left-4 text-blue-400 shrink-0" size={20} />
                        <input
                            type="date"
                            value={splitDateTime(formData.recruitment_deadline).date}
                            onChange={e => {
                                const newDate = joinDateTime(e.target.value, splitDateTime(formData.recruitment_deadline).time);
                                updateField('recruitment_deadline', newDate);
                            }}
                            className="w-full pl-12 pr-4 py-4 bg-transparent outline-none font-bold text-gray-700 text-sm"
                        />
                    </div>
                    <div className="flex-1 flex items-center h-[52px]">
                        <div className="pl-4 pr-2 flex justify-center items-center h-full">    
                            <Clock className="text-blue-400 shrink-0" size={20} />
                        </div>
                        <div className="flex-1 px-2">
                            <IntuitiveTimePicker
                                value={splitDateTime(formData.recruitment_deadline).time}
                                onChange={time => {
                                    const newDate = joinDateTime(splitDateTime(formData.recruitment_deadline).date, time);
                                    updateField('recruitment_deadline', newDate);
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Row 2: Capacity */}
                <div className="relative flex items-center bg-gray-50/20">
                    <Users className="absolute left-4 text-gray-400 shrink-0" size={20} />
                    <input
                        type="number"
                        placeholder={`모집 인원 ${mode === CATEGORIES.PROGRAM ? '(필수)' : ''} 예: 10 (0: 무제한)`}
                        value={formData.max_capacity}
                        onChange={e => updateField('max_capacity', e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-transparent outline-none font-bold text-gray-700 text-sm"
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
