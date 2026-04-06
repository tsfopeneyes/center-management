import React from 'react';
import PropTypes from 'prop-types';
import IntuitiveTimePicker from '../../../../common/IntuitiveTimePicker';
import { splitDateTime, joinDateTime } from '../../utils/noticeHelpers';
import { PROGRAM_TYPES } from '../../utils/constants';
import { Calendar, Clock, MapPin, Gift, CheckSquare } from 'lucide-react';

const ProgramInfoSection = ({ formData, updateField }) => {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap md:flex-nowrap gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 items-center">
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                        type="radio"
                        name="program_type"
                        checked={formData.program_type === PROGRAM_TYPES.CENTER || !formData.program_type}
                        onChange={() => updateField('program_type', PROGRAM_TYPES.CENTER)}
                        className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-bold text-gray-700">센터 프로그램</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                        type="radio"
                        name="program_type"
                        checked={formData.program_type === PROGRAM_TYPES.SCHOOL_CHURCH}
                        onChange={() => updateField('program_type', PROGRAM_TYPES.SCHOOL_CHURCH)}
                        className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-bold text-gray-700">스처 프로그램</span>
                </label>

                <div className="md:ml-auto w-full md:w-auto flex flex-wrap items-center gap-3 mt-2 md:mt-0">
                    <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-xl border border-gray-200">
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

            <div className="border border-blue-200 rounded-2xl bg-white overflow-hidden focus-within:border-blue-500 transition-colors shadow-sm">
                
                {/* Row 1: Date & Time */}
                <div className="flex flex-col sm:flex-row border-b border-gray-200">
                    <div className="relative flex-1 border-b sm:border-b-0 sm:border-r border-gray-200 flex items-center">
                        <Calendar className="absolute left-4 text-blue-400 shrink-0" size={20} />
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
                            className="w-full pl-12 pr-4 py-4 bg-transparent outline-none font-bold text-gray-700 text-sm"
                            required
                        />
                    </div>
                    <div className="flex-1 flex items-center h-[52px]">
                        <div className="pl-4 pr-2 flex justify-center items-center h-full">    
                            <Clock className="text-blue-400 shrink-0" size={20} />
                        </div>
                        <div className="flex-1 px-2">
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
                </div>

                {/* Row 2: Duration */}
                <div className="relative border-b border-gray-200 flex items-center">
                    <Clock className="absolute left-4 text-gray-400 shrink-0" size={20} />
                    <input
                        type="text"
                        placeholder="예: 2시간 (소요 시간)"
                        value={formData.program_duration}
                        onChange={e => updateField('program_duration', e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-transparent outline-none font-bold text-gray-700 text-sm"
                        required
                    />
                </div>

                {/* Row 3: Location */}
                <div className="relative border-b border-gray-200 flex items-center">
                    <MapPin className="absolute left-4 text-gray-400 shrink-0" size={20} />
                    <input
                        type="text"
                        placeholder="예: 센터 멀티룸 (장소)"
                        value={formData.program_location}
                        onChange={e => updateField('program_location', e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-transparent outline-none font-bold text-gray-700 text-sm"
                        required
                    />
                </div>

                {/* Row 4: Hyphen Points */}
                <div className="flex flex-col sm:flex-row relative">
                    <div className="relative flex-1 border-b sm:border-b-0 sm:border-r border-gray-200 flex items-center">
                        <Gift className="absolute left-4 text-indigo-400 shrink-0" size={20} />
                        <input
                            type="number"
                            placeholder="단위: 하이픈 (지급 포인트)"
                            min="0"
                            value={formData.hyphen_reward || ''}
                            onChange={e => updateField('hyphen_reward', e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-transparent outline-none font-bold text-gray-700 text-sm"
                        />
                    </div>
                    <label className="flex-1 flex items-center gap-2 px-4 py-4 bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors">
                        <CheckSquare className={`shrink-0 ${formData.is_review_required ? 'text-indigo-600' : 'text-gray-300'}`} size={20} />
                        <input
                            type="checkbox"
                            checked={formData.is_review_required || false}
                            onChange={(e) => updateField('is_review_required', e.target.checked)}
                            className="hidden"
                        />
                        <div className="flex flex-col justify-center">
                            <span className="text-xs font-bold text-gray-700 leading-tight">리뷰 작성 필수</span>
                            <span className="text-[10px] font-normal text-gray-400 leading-tight block">리뷰 완료 시 포인트 자동 지급</span>
                        </div>
                    </label>
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
