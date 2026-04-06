import React from 'react';
import PropTypes from 'prop-types';
import IntuitiveTimePicker from '../../../../common/IntuitiveTimePicker';
import { CATEGORIES } from '../../utils/constants';
import { splitDateTime, joinDateTime } from '../../utils/noticeHelpers';
import { Calendar, Clock, CheckCircle2 } from 'lucide-react';

const PostSettings = ({ formData, updateField, mode }) => {
    // Only show these settings for NOTICE or PROGRAM mode
    if (mode !== CATEGORIES.NOTICE && mode !== CATEGORIES.PROGRAM) {
        return null;
    }

    return (
        <div className="space-y-4">
            <p className="text-xs font-bold text-gray-400 ml-1">게시글 설정</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <label className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 px-2 py-3 sm:py-2.5 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100 text-center sm:text-left">
                    <input 
                        type="checkbox" 
                        checked={formData.is_sticky} 
                        onChange={e => updateField('is_sticky', e.target.checked)} 
                        className="w-4 h-4 text-orange-600 rounded" 
                    />
                    <span className="text-[12px] sm:text-sm font-bold text-gray-700 tracking-tight leading-tight">고정 공지</span>
                </label>

                <label className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 px-2 py-3 sm:py-2.5 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100 text-center sm:text-left">
                    <input 
                        type="checkbox" 
                        checked={formData.is_recruiting} 
                        onChange={e => updateField('is_recruiting', e.target.checked)} 
                        className="w-4 h-4 text-blue-600 rounded" 
                    />
                    <span className="text-[12px] sm:text-sm font-bold text-gray-700 tracking-tight leading-tight">참석여부 모집</span>
                </label>

                <label className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 px-2 py-3 sm:py-2.5 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100 text-center sm:text-left">
                    <input 
                        type="checkbox" 
                        checked={formData.send_push} 
                        onChange={e => updateField('send_push', e.target.checked)} 
                        className="w-4 h-4 text-red-600 rounded" 
                    />
                    <span className="text-[12px] sm:text-sm font-bold text-gray-700 tracking-tight leading-tight shrink-0">🔔 푸시 발송</span>
                </label>

                <label className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 px-2 py-3 sm:py-2.5 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100 text-center sm:text-left">
                    <input 
                        type="checkbox" 
                        checked={formData.is_poll} 
                        onChange={e => updateField('is_poll', e.target.checked)} 
                        className="w-4 h-4 text-purple-600 rounded" 
                    />
                    <span className="text-[12px] sm:text-sm font-bold text-gray-700 tracking-tight leading-tight shrink-0">📊 투표 열기</span>
                </label>
            </div>
            
            {/* Poll Deadline Settings (Visible if is_poll is checked) */}
            {formData.is_poll && (
                <div className="mt-4 border border-purple-200 rounded-2xl bg-white overflow-hidden shadow-sm animate-fade-in">
                    <div className="bg-purple-50/50 px-4 py-3 border-b border-purple-100 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                        <span className="text-xs font-bold text-purple-700 tracking-wide uppercase">투표 세부 설정</span>
                    </div>
                    
                    {/* Deadline Row */}
                    <div className="flex flex-col sm:flex-row border-b border-purple-100">
                        <div className="relative flex-1 border-b sm:border-b-0 sm:border-r border-purple-100 flex items-center">
                            <Calendar className="absolute left-4 text-purple-400 shrink-0" size={20} />
                            <input
                                type="date"
                                value={splitDateTime(formData.poll_deadline).date}
                                onChange={e => {
                                    const newDate = joinDateTime(e.target.value, splitDateTime(formData.poll_deadline).time);
                                    updateField('poll_deadline', newDate);
                                }}
                                className="w-full pl-12 pr-4 py-4 bg-transparent outline-none font-bold text-gray-700 text-sm"
                            />
                        </div>
                        <div className="flex-1 flex items-center h-[52px]">
                            <div className="pl-4 pr-2 flex justify-center items-center h-full">    
                                <Clock className="text-purple-400 shrink-0" size={20} />
                            </div>
                            <div className="flex-1 px-2">
                                <IntuitiveTimePicker
                                    value={splitDateTime(formData.poll_deadline).time}
                                    onChange={time => {
                                        const newDate = joinDateTime(splitDateTime(formData.poll_deadline).date, time);
                                        updateField('poll_deadline', newDate);
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Option Count Row */}
                    <div className="flex flex-col sm:flex-row">
                        <button
                            type="button"
                            onClick={() => updateField('allow_multiple_votes', false)}
                            className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-bold transition-colors border-b sm:border-b-0 sm:border-r border-purple-100 ${
                                !formData.allow_multiple_votes 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-transparent text-gray-500 hover:bg-purple-50'
                            }`}
                        >
                            {!formData.allow_multiple_votes && <CheckCircle2 size={16} />} 
                            단일투표 (1개만)
                        </button>
                        <button
                            type="button"
                            onClick={() => updateField('allow_multiple_votes', true)}
                            className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-bold transition-colors ${
                                formData.allow_multiple_votes 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-transparent text-gray-500 hover:bg-purple-50'
                            }`}
                        >
                            {formData.allow_multiple_votes && <CheckCircle2 size={16} />}
                            중복투표 (다중선택)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

PostSettings.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
    mode: PropTypes.string.isRequired
};

export default React.memo(PostSettings);
