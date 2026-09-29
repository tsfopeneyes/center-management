import React from 'react';
import PropTypes from 'prop-types';
import { Calendar, Clock } from 'lucide-react';
import DatePicker from '../../../components/common/DatePicker';
import TimePicker from '../../../components/common/TimePicker';
import DateTimeFields from '../../../components/admin/board/components/forms/DateTimeFields';
import { splitDateTime, joinDateTime } from '../../../components/admin/board/utils/noticeHelpers';

const ProgramScheduleSettings = ({ formData, updateField, isScheduledRegistration }) => (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.015)] space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80">
            <Calendar size={18} className="text-blue-600" />
            <span className="text-sm font-bold text-slate-800">진행 일정 설정</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {formData.is_challenge ? (
                // Challenge Program (Start Date & End Date)
                <div className="space-y-4 lg:col-span-2">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">챌린지 진행 기간</label>
                        <div className="flex items-center gap-3">
                            <DatePicker
                                label="챌린지 시작 날짜"
                                className="flex-1"
                                value={formData.program_start_date || ''}
                                onChange={startDate => {
                                    updateField('program_start_date', startDate);
                                    if (formData.challenge_has_time) {
                                        updateField('program_date', joinDateTime(startDate, splitDateTime(formData.program_date).time));
                                    }
                                }}
                                required
                            />
                            <span className="text-slate-400 font-bold text-xs">~</span>
                            <DatePicker
                                label="챌린지 종료 날짜"
                                className="flex-1"
                                value={formData.program_end_date || ''}
                                onChange={date => updateField('program_end_date', date)}
                                required
                            />
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">챌린지가 진행되는 전체 기간입니다.</p>
                    </div>

                    {formData.challenge_format !== 'ONLINE' && <label className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200/70 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                        <input
                            type="checkbox"
                            checked={formData.challenge_has_time === true}
                            onChange={e => {
                                const enabled = e.target.checked;
                                updateField('challenge_has_time', enabled);
                                if (enabled && formData.program_start_date && !formData.program_date) {
                                    updateField('program_date', joinDateTime(formData.program_start_date, '12:00'));
                                }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                            <p className="text-xs font-bold text-slate-700">시작 시간 및 소요 시간 설정</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">정해진 시간에 진행되는 챌린지일 때 사용합니다.</p>
                        </div>
                    </label>}

                    {formData.challenge_format !== 'ONLINE' && formData.challenge_has_time && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">시작 시간</label>
                                <TimePicker
                                    label="챌린지 시작 시간"
                                    value={splitDateTime(formData.program_date).time}
                                    onChange={time => updateField(
                                        'program_date',
                                        joinDateTime(formData.program_start_date, time)
                                    )}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">소요 시간</label>
                                <div className="relative h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                    <Clock className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                                    <input
                                        type="text"
                                        placeholder="예: 2시간 또는 90분"
                                        value={formData.program_duration || ''}
                                        onChange={e => updateField('program_duration', e.target.value)}
                                        className="w-full h-full pl-10 pr-3 bg-transparent outline-none font-bold text-slate-800 text-xs"
                                        required={!isScheduledRegistration}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : formData.schedule_mode !== 'RECURRING' ? (
                // Single open/application program
                <div className="lg:col-span-2 grid min-w-0 grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
                    <div className="min-w-0 space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">프로그램 일시</label>
                        <DateTimeFields
                            label="프로그램 일시"
                            value={formData.program_date}
                            required
                            onChange={nextDate => {
                                updateField('program_date', nextDate);
                                if (nextDate && !formData.recruitment_deadline) {
                                    updateField('recruitment_deadline', nextDate);
                                }
                            }}
                        />
                        <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">프로그램이 시작되는 날짜와 시간입니다.</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">소요 시간</label>
                        <div className="relative h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                            <Clock className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                            <input
                                type="text"
                                placeholder="예: 2시간 또는 1.5시간"
                                aria-label="소요 시간"
                                value={formData.program_duration}
                                onChange={e => updateField('program_duration', e.target.value)}
                                className="w-full h-full pl-10 pr-3 bg-transparent outline-none font-bold text-slate-800 text-xs"
                                required={!isScheduledRegistration}
                            />
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">마감 시각 자동 계산 및 노출용 정보입니다.</p>
                    </div>
                </div>
            ) : (
                // Open Program (Start Date, End Date, Time & Days)
                <>
                    <div className="space-y-1.5 lg:col-span-2">
                        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">프로그램 기간 및 시간</label>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <DatePicker
                                    label="프로그램 시작 날짜"
                                    className="flex-1"
                                    value={formData.program_start_date || ''}
                                    onChange={date => {
                                        updateField('program_start_date', date);
                                        const timePart = splitDateTime(formData.program_date).time;
                                        updateField('program_date', joinDateTime(date, timePart));
                                    }}
                                    required
                                />
                                <span className="text-slate-400 font-bold text-xs shrink-0 px-1">~</span>
                                <DatePicker
                                    label="프로그램 종료 날짜"
                                    className="flex-1"
                                    value={formData.program_end_date || ''}
                                    onChange={date => updateField('program_end_date', date)}
                                    required
                                />
                            </div>
                            <TimePicker
                                label="프로그램 시작 시간"
                                value={splitDateTime(formData.program_date).time}
                                onChange={time => {
                                    const datePart = formData.program_start_date || splitDateTime(formData.program_date).date;
                                    const newDate = joinDateTime(datePart, time);
                                    updateField('program_date', newDate);
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:col-span-2 pt-2 border-t border-slate-100/60">
                        {/* Left Column: 소요 시간 */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">소요 시간</label>
                            <div className="relative h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                <Clock className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                                <input
                                    type="text"
                                    placeholder="예: 2시간 또는 1.5시간"
                                    value={formData.program_duration}
                                    onChange={e => updateField('program_duration', e.target.value)}
                                    className="w-full h-full pl-10 pr-3 bg-transparent outline-none font-bold text-slate-800 text-xs"
                                    required={!isScheduledRegistration}
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">매회 진행되는 소요 시간 정보입니다.</p>
                        </div>

                        {/* Right Column: 진행 요일 선택 */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">진행 요일 선택</label>
                            <div className="flex flex-wrap gap-1.5 py-0.5">
                                {[
                                    { label: '일', val: 0 },
                                    { label: '월', val: 1 },
                                    { label: '화', val: 2 },
                                    { label: '수', val: 3 },
                                    { label: '목', val: 4 },
                                    { label: '금', val: 5 },
                                    { label: '토', val: 6 }
                                ].map(day => {
                                    const days = formData.program_days || [];
                                    const isSelected = days.includes(day.val);
                                    return (
                                        <button
                                            type="button"
                                            key={day.val}
                                            onClick={() => {
                                                const nextDays = isSelected
                                                    ? days.filter(d => d !== day.val)
                                                    : [...days, day.val].sort();
                                                updateField('program_days', nextDays);
                                            }}
                                            className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${
                                                isSelected
                                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-100'
                                                    : 'bg-slate-50 text-slate-600 border border-slate-200/60 hover:bg-slate-100'
                                            }`}
                                        >
                                            {day.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">선택된 요일에 학생 캘린더 일정이 자동으로 표시됩니다.</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    </div>
);

ProgramScheduleSettings.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
    isScheduledRegistration: PropTypes.bool.isRequired,
};

export default ProgramScheduleSettings;
