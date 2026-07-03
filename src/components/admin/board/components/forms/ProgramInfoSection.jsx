import React from 'react';
import PropTypes from 'prop-types';
import IntuitiveTimePicker from '../../../../common/IntuitiveTimePicker';
import { splitDateTime, joinDateTime } from '../../utils/noticeHelpers';
import { PROGRAM_TYPES } from '../../utils/constants';
import { Calendar, Clock, MapPin, Gift, CheckSquare, Users } from 'lucide-react';

const HYPHEN_DETAILS = [
    'B1F STAGE',
    '2F SQUARE',
    '3F ROUND',
    '4F CONNECT 1',
    '4F CONNECT 2',
    '4F CONNECT 3',
    '4F CONNECT ROOM',
    '6F LOUNGE'
];

const ProgramInfoSection = ({ formData, updateField, flat = false }) => {
    // Local state to keep track of selection category without losing state when parent is empty
    const [localMain, setLocalMain] = React.useState(() => {
        const locationStr = formData.program_location || '';
        if (locationStr === '이높플레이스') return '이높플레이스';
        if (locationStr.startsWith('하이픈 ')) {
            const detail = locationStr.substring(4);
            if (HYPHEN_DETAILS.includes(detail)) return '하이픈';
        }
        if (locationStr) return '기타';
        return '';
    });

    const [selectedDetail, setSelectedDetail] = React.useState(() => {
        const locationStr = formData.program_location || '';
        if (locationStr.startsWith('하이픈 ')) {
            const detail = locationStr.substring(4);
            if (HYPHEN_DETAILS.includes(detail)) return detail;
        }
        return '';
    });

    const [customVal, setCustomVal] = React.useState(() => {
        const locationStr = formData.program_location || '';
        if (locationStr && locationStr !== '이높플레이스' && !locationStr.startsWith('하이픈 ')) {
            return locationStr;
        }
        return '';
    });

    // Derive what the location string should be based on local states
    let expectedLocationStr = '';
    if (localMain === '이높플레이스') {
        expectedLocationStr = '이높플레이스';
    } else if (localMain === '하이픈') {
        expectedLocationStr = selectedDetail ? `하이픈 ${selectedDetail}` : '';
    } else if (localMain === '기타') {
        expectedLocationStr = customVal;
    }

    // Sync local state if parent changes externally (initial load, reset, etc.)
    const parentLocation = formData.program_location || '';
    React.useEffect(() => {
        if (parentLocation !== expectedLocationStr) {
            if (parentLocation === '이높플레이스') {
                setLocalMain('이높플레이스');
            } else if (parentLocation.startsWith('하이픈 ')) {
                setLocalMain('하이픈');
                const detail = parentLocation.substring(4);
                if (HYPHEN_DETAILS.includes(detail)) {
                    setSelectedDetail(detail);
                } else {
                    setLocalMain('기타');
                    setCustomVal(parentLocation);
                }
            } else if (parentLocation) {
                setLocalMain('기타');
                setCustomVal(parentLocation);
            } else {
                setLocalMain('');
                setSelectedDetail('');
                setCustomVal('');
            }
        }
    }, [parentLocation, expectedLocationStr]);

    const handleMainChange = (e) => {
        const mainVal = e.target.value;
        setLocalMain(mainVal);
        if (mainVal === '이높플레이스') {
            updateField('program_location', '이높플레이스');
        } else if (mainVal === '하이픈') {
            setSelectedDetail('B1F STAGE');
            updateField('program_location', '하이픈 B1F STAGE');
        } else {
            setCustomVal('');
            updateField('program_location', '');
        }
    };

    const handleDetailChange = (e) => {
        const detailVal = e.target.value;
        setSelectedDetail(detailVal);
        updateField('program_location', `하이픈 ${detailVal}`);
    };

    const handleCustomChange = (e) => {
        const val = e.target.value;
        setCustomVal(val);
        updateField('program_location', val);
    };

    return (
        <div className="space-y-6">
            {/* Top Config: Program Type & Tags */}
            <div className={flat 
                ? "flex flex-col gap-4 bg-slate-100/50 rounded-2xl border border-slate-200/80 p-4" 
                : "flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-100/50 rounded-2xl border border-slate-200/80 p-4"
            }>
                {/* Left: Program Type Segmented Control */}
                <div className={flat 
                    ? "flex w-full bg-slate-200/80 p-1 rounded-xl" 
                    : "flex items-center bg-slate-200/80 p-1 rounded-xl self-start"
                }>
                    <button
                        type="button"
                        onClick={() => updateField('program_type', PROGRAM_TYPES.CENTER)}
                        className={flat 
                            ? `flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                                (!formData.program_type || formData.program_type === PROGRAM_TYPES.CENTER)
                                    ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                                    : 'text-slate-600 hover:text-slate-900'
                              }`
                            : `px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                                (!formData.program_type || formData.program_type === PROGRAM_TYPES.CENTER)
                                    ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                                    : 'text-slate-600 hover:text-slate-900'
                              }`
                        }
                    >
                        센터 프로그램
                    </button>
                    <button
                        type="button"
                        onClick={() => updateField('program_type', PROGRAM_TYPES.SCHOOL_CHURCH)}
                        className={flat 
                            ? `flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                                formData.program_type === PROGRAM_TYPES.SCHOOL_CHURCH
                                    ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                                    : 'text-slate-600 hover:text-slate-900'
                              }`
                            : `px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                                formData.program_type === PROGRAM_TYPES.SCHOOL_CHURCH
                                    ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                                    : 'text-slate-600 hover:text-slate-900'
                              }`
                        }
                    >
                        스처 프로그램
                    </button>
                </div>

                {/* Right: Target Region and Leader only Chips */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-bold mr-1">대상 지역</span>
                        {['강동', '강서'].map(region => {
                            const isSelected = formData.target_regions?.includes(region);
                            return (
                                <button
                                    type="button"
                                    key={region}
                                    onClick={() => {
                                        const current = formData.target_regions || [];
                                        const nextRegions = isSelected
                                            ? current.filter(r => r !== region)
                                            : [...current, region];
                                        updateField('target_regions', nextRegions);
                                    }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${
                                        isSelected
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-100'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {region}
                                </button>
                            );
                        })}
                    </div>

                    <div className="w-px h-4 bg-slate-300 mx-1" />

                    <button
                        type="button"
                        onClick={() => updateField('is_leader_only', !formData.is_leader_only)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${
                            formData.is_leader_only
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-100'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        리더 전용
                    </button>
                </div>
            </div>

            {/* Participation Type (Open vs Application) Selection Cards */}
            <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-500 ml-1">운영 방식</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Open Program Card */}
                    <button
                        type="button"
                        onClick={() => {
                            updateField('is_recruiting', false);
                            updateField('max_capacity', '');
                        }}
                        className={`p-4 rounded-2xl text-left border-2 transition-all duration-200 flex items-start gap-3 ${
                            formData.is_recruiting === false
                                ? 'border-blue-600 bg-blue-50/10 shadow-[0_4px_12px_rgba(49,130,246,0.03)]'
                                : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                    >
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            formData.is_recruiting === false ? 'border-blue-600' : 'border-slate-300'
                        }`}>
                            {formData.is_recruiting === false && (
                                <div className="w-2 h-2 rounded-full bg-blue-600" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-800">오픈 프로그램</p>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed">별도의 신청 절차 없이 모든 학생이 자유롭게 참여할 수 있습니다.</p>
                        </div>
                    </button>

                    {/* Recruiting Program Card */}
                    <button
                        type="button"
                        onClick={() => updateField('is_recruiting', true)}
                        className={`p-4 rounded-2xl text-left border-2 transition-all duration-200 flex items-start gap-3 ${
                            formData.is_recruiting === true
                                ? 'border-blue-600 bg-blue-50/10 shadow-[0_4px_12px_rgba(49,130,246,0.03)]'
                                : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                    >
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            formData.is_recruiting === true ? 'border-blue-600' : 'border-slate-300'
                        }`}>
                            {formData.is_recruiting === true && (
                                <div className="w-2 h-2 rounded-full bg-blue-600" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-800">신청 프로그램</p>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed">선착순 마감 등 사전 신청을 하고 승인받은 학생만 참여합니다.</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* Unified Program Information Section Card */}
            <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-500 ml-1">상세 설정</span>
                
                <div className="border border-slate-200/70 rounded-2xl bg-white overflow-hidden shadow-sm transition-all focus-within:border-blue-500">
                    
                    {/* Row 1: Schedule & Duration */}
                    <div className={flat ? "flex flex-col" : "flex flex-col md:flex-row border-b border-slate-100"}>
                        {/* Left: Schedule */}
                        <div className={flat 
                            ? "p-4 border-b border-slate-100 space-y-2" 
                            : "flex-1 p-4 border-b md:border-b-0 md:border-r border-slate-100 space-y-2"
                        }>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <Calendar size={15} className="text-slate-400" />
                                <span>프로그램 일정</span>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 relative flex items-center bg-slate-50/50 border border-slate-200/80 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                    <Calendar className="absolute left-3 text-slate-400 shrink-0" size={15} />
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
                                        className="w-full pl-10 pr-3 py-3 bg-transparent outline-none font-semibold text-slate-700 text-sm cursor-pointer"
                                        required
                                    />
                                </div>
                                <div className="flex-1 flex items-center bg-slate-50/50 border border-slate-200/80 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3">
                                    <Clock className="text-slate-400 shrink-0 mr-2" size={15} />
                                    <div className="flex-1">
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
                            <p className="text-[11px] text-slate-400 font-medium ml-1">
                                실제 진행되는 시작 날짜와 시간입니다.
                            </p>
                        </div>

                        {/* Right: Duration */}
                        <div className={flat 
                            ? "p-4 border-b border-slate-100 space-y-2" 
                            : "w-full md:w-1/3 p-4 space-y-2"
                        }>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <Clock size={15} className="text-slate-400" />
                                <span>소요 시간</span>
                            </div>
                            <div className="relative flex items-center bg-slate-50/50 border border-slate-200/80 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                <Clock className="absolute left-3 text-slate-400 shrink-0" size={15} />
                                <input
                                    type="text"
                                    placeholder="예: 2시간 또는 1.5시간"
                                    value={formData.program_duration}
                                    onChange={e => updateField('program_duration', e.target.value)}
                                    className="w-full pl-10 pr-3 py-3 bg-transparent outline-none font-semibold text-slate-700 text-sm"
                                    required
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium ml-1">
                                마감 시각 자동 계산용입니다. (예: 2시간)
                            </p>
                        </div>
                    </div>

                    {/* Row 1.5: Recurring Schedule (Conditional on is_recruiting === false) */}
                    {!formData.is_recruiting && (
                        <div className={flat 
                            ? "flex flex-col bg-slate-50/20 border-b border-slate-100 p-4 space-y-4" 
                            : "flex flex-col border-b border-slate-100 bg-slate-50/20 p-4 space-y-4"
                        }>
                            {/* Toggle Row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock size={15} className="text-slate-400" />
                                    <span className="text-xs font-bold text-slate-700">반복 일정 설정 (오픈 프로그램)</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.is_recurring || false}
                                        onChange={e => {
                                            updateField('is_recurring', e.target.checked);
                                            if (!e.target.checked) {
                                                updateField('recurring_days', []);
                                                updateField('recurring_end_date', '');
                                            }
                                        }}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* Recurring Options */}
                            {formData.is_recurring && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 animate-fade-in">
                                    {/* Select Days of the Week */}
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[11px] font-bold text-slate-500 block">반복 요일 선택</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {[
                                                { label: '일', val: 0 },
                                                { label: '월', val: 1 },
                                                { label: '화', val: 2 },
                                                { label: '수', val: 3 },
                                                { label: '목', val: 4 },
                                                { label: '금', val: 5 },
                                                { label: '토', val: 6 }
                                            ].map(day => {
                                                const days = formData.recurring_days || [];
                                                const isSelected = days.includes(day.val);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={day.val}
                                                        onClick={() => {
                                                            const nextDays = isSelected
                                                                ? days.filter(d => d !== day.val)
                                                                : [...days, day.val].sort();
                                                            updateField('recurring_days', nextDays);
                                                        }}
                                                        className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                                                            isSelected 
                                                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-100' 
                                                                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {day.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Select End Date */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-500 block">반복 종료일</label>
                                        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                            <Calendar className="absolute left-3 text-slate-400 shrink-0" size={14} />
                                            <input
                                                type="date"
                                                value={formData.recurring_end_date || ''}
                                                onChange={e => updateField('recurring_end_date', e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 bg-transparent outline-none font-semibold text-slate-700 text-xs cursor-pointer"
                                                required={formData.is_recurring}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Row 2: Recruitment Deadline & Capacity (Conditional on is_recruiting) */}
                    {formData.is_recruiting && (
                        <div className={flat 
                            ? "flex flex-col bg-slate-50/20 border-b border-slate-100 animate-fade-in" 
                            : "flex flex-col md:flex-row border-b border-slate-100 bg-slate-50/20 animate-fade-in"
                        }>
                            {/* Left: Deadline */}
                            <div className={flat 
                                ? "p-4 border-b border-slate-100 space-y-2" 
                                : "flex-1 p-4 border-b md:border-b-0 md:border-r border-slate-100 space-y-2"
                            }>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <Clock size={15} className="text-slate-400" />
                                    <span>신청 마감 시간</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1 relative flex items-center bg-slate-50/50 border border-slate-200/80 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                        <Calendar className="absolute left-3 text-slate-400 shrink-0" size={15} />
                                        <input
                                            type="date"
                                            value={splitDateTime(formData.recruitment_deadline).date}
                                            onChange={e => {
                                                const newDate = joinDateTime(e.target.value, splitDateTime(formData.recruitment_deadline).time);
                                                updateField('recruitment_deadline', newDate);
                                            }}
                                            className="w-full pl-10 pr-3 py-3 bg-transparent outline-none font-semibold text-slate-700 text-sm cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex-1 flex items-center bg-slate-50/50 border border-slate-200/80 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3">
                                        <Clock className="text-slate-400 shrink-0 mr-2" size={15} />
                                        <div className="flex-1">
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
                                <p className="text-[11px] text-slate-400 font-medium ml-1">
                                    생략하면 프로그램 시작 시간과 같아집니다.
                                </p>
                            </div>

                            {/* Right: Capacity */}
                            <div className={flat 
                                ? "p-4 space-y-2" 
                                : "w-full md:w-1/3 p-4 space-y-2"
                            }>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <Users size={15} className="text-slate-400" />
                                    <span>모집 정원</span>
                                </div>
                                <div className="relative flex items-center bg-slate-50/50 border border-slate-200/80 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                    <Users className="absolute left-3 text-slate-400 shrink-0" size={15} />
                                    <input
                                        type="number"
                                        placeholder="예: 10 (0: 무제한)"
                                        value={formData.max_capacity}
                                        onChange={e => updateField('max_capacity', e.target.value)}
                                        className="w-full pl-10 pr-3 py-3 bg-transparent outline-none font-semibold text-slate-700 text-sm"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium ml-1">
                                    0을 입력하면 인원 제한이 없어집니다.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Row 3: Location */}
                    <div className="p-4 border-b border-slate-100 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            <MapPin size={15} className="text-slate-400" />
                            <span>진행 장소</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <select
                                value={localMain}
                                onChange={handleMainChange}
                                className="flex-1 p-3 bg-slate-50/50 border border-slate-200/80 rounded-xl outline-none text-sm font-semibold text-slate-700 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
                                required
                            >
                                <option value="">공간 선택</option>
                                <option value="하이픈">하이픈</option>
                                <option value="이높플레이스">이높플레이스</option>
                                <option value="기타">기타</option>
                            </select>

                            {localMain === '하이픈' && (
                                <select
                                    value={selectedDetail}
                                    onChange={handleDetailChange}
                                    className="flex-1 p-3 bg-slate-50/50 border border-slate-200/80 rounded-xl outline-none text-sm font-semibold text-slate-700 focus:border-blue-600 focus:bg-white transition-all cursor-pointer animate-fade-in"
                                    required
                                >
                                    <option value="">세부 공간 선택</option>
                                    {HYPHEN_DETAILS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            )}

                            {localMain === '기타' && (
                                <input
                                    type="text"
                                    placeholder="예: 오아센터 (자유롭게 입력)"
                                    value={customVal}
                                    onChange={handleCustomChange}
                                    className="flex-1 p-3 bg-slate-50/50 border border-slate-200/80 rounded-xl outline-none text-sm font-semibold text-slate-700 focus:border-blue-600 focus:bg-white transition-all animate-fade-in"
                                    required
                                />
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium ml-1">
                            {localMain === '하이픈' && "공간 이름 - 세부 공간 이름 순으로 표기됩니다. (예: '하이픈 B1F STAGE')"}
                            {localMain === '이높플레이스' && "공간 이름만 표기됩니다. (예: '이높플레이스')"}
                            {localMain === '기타' && "입력하신 텍스트가 그대로 표기됩니다. (예: '오아센터')"}
                            {!localMain && "공간 유형을 선택해 주세요."}
                        </p>
                    </div>

                    {/* Row 4: Hyphen Points */}
                    <div className="p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            <Gift size={15} className="text-slate-400" />
                            <span>지급 포인트 및 리뷰 설정</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 relative flex items-center bg-slate-50/50 border border-slate-200/80 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                <Gift className="absolute left-3 text-slate-400 shrink-0" size={15} />
                                <input
                                    type="number"
                                    placeholder="단위: 하이픈 (지급 포인트)"
                                    min="0"
                                    value={formData.hyphen_reward || ''}
                                    onChange={e => updateField('hyphen_reward', e.target.value)}
                                    className="w-full pl-10 pr-3 py-3 bg-transparent outline-none font-semibold text-slate-700 text-sm"
                                />
                            </div>
                            
                            <label className={`flex-1 flex items-center gap-2.5 px-3 py-3 border rounded-xl cursor-pointer transition-all duration-200 ${
                                formData.is_review_required 
                                    ? 'bg-blue-50/20 border-blue-500/30 text-blue-600' 
                                    : 'bg-slate-50/50 border-slate-200/80 text-slate-400 hover:bg-slate-100/50'
                            }`}>
                                <CheckSquare className="shrink-0" size={16} />
                                <input
                                    type="checkbox"
                                    checked={formData.is_review_required || false}
                                    onChange={(e) => updateField('is_review_required', e.target.checked)}
                                    className="hidden"
                                />
                                <div className="flex flex-col justify-center text-left">
                                    <span className={`text-xs font-bold leading-tight ${formData.is_review_required ? 'text-blue-700' : 'text-slate-700'}`}>리뷰 작성 필수</span>
                                    <span className="text-[10px] font-medium text-slate-400 leading-tight block mt-0.5">리뷰 완료 시 포인트 자동 지급</span>
                                </div>
                            </label>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium ml-1">
                            프로그램 참여 학생에게 지급할 HP(하이픈 포인트)를 입력하고, 리뷰 작성을 필수로 제한할지 결정합니다.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

ProgramInfoSection.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
    flat: PropTypes.bool
};

export default React.memo(ProgramInfoSection);
