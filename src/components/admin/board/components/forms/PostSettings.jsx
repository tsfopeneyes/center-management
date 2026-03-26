import React from 'react';
import PropTypes from 'prop-types';
import IntuitiveTimePicker from '../../../../common/IntuitiveTimePicker';
import { CATEGORIES } from '../../utils/constants';
import { splitDateTime, joinDateTime } from '../../utils/noticeHelpers';

const PostSettings = ({ formData, updateField, mode }) => {
    // Only show these settings for NOTICE or PROGRAM mode
    if (mode !== CATEGORIES.NOTICE && mode !== CATEGORIES.PROGRAM) {
        return null;
    }

    return (
        <div className="space-y-4">
            <p className="text-xs font-bold text-gray-400 ml-1">게시글 설정</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100">
                    <input 
                        type="checkbox" 
                        checked={formData.is_sticky} 
                        onChange={e => updateField('is_sticky', e.target.checked)} 
                        className="w-5 h-5 text-orange-600 rounded-lg" 
                    />
                    <span className="text-sm font-bold text-gray-700">상단 고정 공지</span>
                </label>

                <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100">
                    <input 
                        type="checkbox" 
                        checked={formData.is_recruiting} 
                        onChange={e => updateField('is_recruiting', e.target.checked)} 
                        className="w-5 h-5 text-blue-600 rounded-lg" 
                    />
                    <span className="text-sm font-bold text-gray-700">학생들에게 참석여부 묻기</span>
                </label>

                <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100">
                    <input 
                        type="checkbox" 
                        checked={formData.send_push} 
                        onChange={e => updateField('send_push', e.target.checked)} 
                        className="w-5 h-5 text-red-600 rounded-lg" 
                    />
                    <span className="text-sm font-bold text-gray-700">🔔 푸시 알림 발송</span>
                </label>

                <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition border border-gray-100">
                    <input 
                        type="checkbox" 
                        checked={formData.is_poll} 
                        onChange={e => updateField('is_poll', e.target.checked)} 
                        className="w-5 h-5 text-purple-600 rounded-lg" 
                    />
                    <span className="text-sm font-bold text-gray-700">📊 투표(설문) 열기</span>
                </label>
            </div>
            
            {/* Poll Deadline Settings (Visible if is_poll is checked) */}
            {formData.is_poll && (
                <div className="mt-4 p-4 bg-purple-50/50 rounded-xl border border-purple-100 flex flex-col gap-4 animate-fade-in">
                    <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-purple-600 shrink-0">투표 마감 일시 설정</label>
                        <div className="flex bg-white border border-purple-200 rounded-lg overflow-hidden w-full max-w-sm">
                            <input
                                type="date"
                                value={splitDateTime(formData.poll_deadline).date}
                                onChange={e => {
                                    const newDate = joinDateTime(e.target.value, splitDateTime(formData.poll_deadline).time);
                                    updateField('poll_deadline', newDate);
                                }}
                                className="w-1/2 p-2 outline-none text-sm bg-transparent border-r border-gray-100"
                            />
                            <IntuitiveTimePicker
                                value={splitDateTime(formData.poll_deadline).time}
                                onChange={time => {
                                    const newDate = joinDateTime(splitDateTime(formData.poll_deadline).date, time);
                                    updateField('poll_deadline', newDate);
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-purple-600 shrink-0">선택 가능한 옵션 수</label>
                        <div className="flex gap-4 items-center">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="allow_multiple_votes" 
                                    checked={!formData.allow_multiple_votes} 
                                    onChange={() => updateField('allow_multiple_votes', false)}
                                    className="w-4 h-4 text-purple-600"
                                />
                                <span className="text-sm font-bold text-gray-700">단일투표 (1개만)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="allow_multiple_votes" 
                                    checked={formData.allow_multiple_votes} 
                                    onChange={() => updateField('allow_multiple_votes', true)}
                                    className="w-4 h-4 text-purple-600"
                                />
                                <span className="text-sm font-bold text-gray-700">중복투표 (여러 개 선택)</span>
                            </label>
                        </div>
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
