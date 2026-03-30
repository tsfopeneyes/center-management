import React from 'react';
import PropTypes from 'prop-types';
import IntuitiveTimePicker from '../../../../common/IntuitiveTimePicker';
import { splitDateTime, joinDateTime } from '../../utils/noticeHelpers';
import { PROGRAM_TYPES } from '../../utils/constants';

const ProgramInfoSection = ({ formData, updateField }) => {
    return (
        <div className="space-y-4">
            <div className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="radio"
                        name="program_type"
                        checked={formData.program_type === PROGRAM_TYPES.CENTER || !formData.program_type}
                        onChange={() => updateField('program_type', PROGRAM_TYPES.CENTER)}
                        className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-bold text-gray-700">센터 프로그램</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="radio"
                        name="program_type"
                        checked={formData.program_type === PROGRAM_TYPES.SCHOOL_CHURCH}
                        onChange={() => updateField('program_type', PROGRAM_TYPES.SCHOOL_CHURCH)}
                        className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-bold text-gray-700">스처 프로그램</span>
                </label>

                <div className="ml-auto flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-xl border border-gray-200">
                        {['강동', '강서'].map(region => (
                            <label key={region} className="flex items-center gap-1.5 cursor-pointer text-sm font-bold">
                                <input
                                    type="checkbox"
                                    checked={formData.target_regions?.includes(region)}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        const current = formData.target_regions || [];
                                        const nextRegions = isChecked
                                            ? [...current, region]
                                            : current.filter(r => r !== region);
                                        updateField('target_regions', nextRegions);
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                />
                                {region}
                            </label>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-xl border border-yellow-200">
                        <input
                            type="checkbox"
                            id="is_leader_only"
                            checked={formData.is_leader_only}
                            onChange={(e) => updateField('is_leader_only', e.target.checked)}
                            className="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500 cursor-pointer"
                        />
                        <label htmlFor="is_leader_only" className="text-sm font-black cursor-pointer flex items-center gap-1">
                            ⭐ 리더 전용
                        </label>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-blue-50/30 p-4 rounded-2xl border border-blue-100/50">
                <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1 ml-1">날짜 / 시간 *</label>
                    <div className="flex flex-col gap-2">
                        <input
                            type="date"
                            value={splitDateTime(formData.program_date).date}
                            onChange={e => {
                                const newDate = joinDateTime(e.target.value, splitDateTime(formData.program_date).time);
                                updateField('program_date', newDate);
                                if (!formData.recruitment_deadline || formData.recruitment_deadline === formData.program_date) {
                                    updateField('recruitment_deadline', newDate);
                                }
                            }}
                            className="w-full p-3 bg-white border border-blue-100 rounded-xl outline-none focus:border-blue-500 transition text-sm"
                            required
                        />
                        <IntuitiveTimePicker
                            value={splitDateTime(formData.program_date).time}
                            onChange={time => {
                                const newDate = joinDateTime(splitDateTime(formData.program_date).date, time);
                                updateField('program_date', newDate);
                                if (!formData.recruitment_deadline || formData.recruitment_deadline === formData.program_date) {
                                    updateField('recruitment_deadline', newDate);
                                }
                            }}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1 ml-1">소요시간 *</label>
                    <input
                        type="text"
                        placeholder="예: 2시간"
                        value={formData.program_duration}
                        onChange={e => updateField('program_duration', e.target.value)}
                        className="w-full p-3 bg-white border border-blue-100 rounded-xl outline-none focus:border-blue-500 transition text-sm h-[46px]"
                        required
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1 ml-1">장소 *</label>
                    <input
                        type="text"
                        placeholder="예: 센터 멀티룸"
                        value={formData.program_location}
                        onChange={e => updateField('program_location', e.target.value)}
                        className="w-full p-3 bg-white border border-blue-100 rounded-xl outline-none focus:border-blue-500 transition text-sm h-[46px]"
                        required
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1 ml-1">지급 하이픈 (포인트)</label>
                    <input
                        type="number"
                        placeholder="예: 5"
                        min="0"
                        value={formData.hyphen_reward}
                        onChange={e => updateField('hyphen_reward', e.target.value)}
                        className="w-full p-3 bg-white border border-blue-100 rounded-xl outline-none focus:border-blue-500 transition text-sm h-[46px]"
                    />
                </div>
            </div>
        </div>
    );
};

ProgramInfoSection.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired
};

export default React.memo(ProgramInfoSection);
