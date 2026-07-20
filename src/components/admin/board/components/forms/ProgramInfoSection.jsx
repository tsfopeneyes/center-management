import React from 'react';
import PropTypes from 'prop-types';
import IntuitiveTimePicker from '../../../../common/IntuitiveTimePicker';
import { splitDateTime, joinDateTime } from '../../utils/noticeHelpers';
import { PROGRAM_TYPES } from '../../utils/constants';
import { Calendar, Clock, MapPin, Gift, CheckSquare, Users, ChevronUp, ChevronDown, MessageSquare, Target, Trash, Bookmark, User, School, Smartphone } from 'lucide-react';
import { supabase } from '../../../../../supabaseClient';

const HAIFN_DETAILS = [
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
    const [admins, setAdmins] = React.useState([]);

    React.useEffect(() => {
        const fetchAdmins = async () => {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('id, name, school')
                    .eq('role', 'admin')
                    .order('name');
                if (error) throw error;
                setAdmins(data || []);
            } catch (err) {
                console.error('Error fetching admins:', err);
            }
        };
        fetchAdmins();
    }, []);

    // Local state to keep track of selection category without losing state when parent is empty
    const [localMain, setLocalMain] = React.useState(() => {
        const locationStr = formData.program_location || '';
        if (locationStr === '이높플레이스') return '이높플레이스';
        if (locationStr.startsWith('하이픈 ')) {
            const detail = locationStr.substring(4);
            if (HAIFN_DETAILS.includes(detail)) return '하이픈';
        }
        if (locationStr) return '기타';
        return '';
    });

    const [selectedDetail, setSelectedDetail] = React.useState(() => {
        const locationStr = formData.program_location || '';
        if (locationStr.startsWith('하이픈 ')) {
            const detail = locationStr.substring(4);
            if (HAIFN_DETAILS.includes(detail)) return detail;
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
                if (HAIFN_DETAILS.includes(detail)) {
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

            {/* Participation Type Selection Cards */}
            <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2 ml-1 block">운영 방식</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Open Program Card */}
                    <button
                        type="button"
                        onClick={() => {
                            updateField('is_challenge', false);
                            updateField('is_recruiting', false);
                            updateField('max_capacity', '');
                        }}
                        className={`p-4 rounded-2xl text-left border-2 transition-all duration-200 flex items-start gap-3 ${
                            (formData.is_recruiting === false && !formData.is_challenge)
                                ? 'border-blue-600 bg-blue-50/10 shadow-[0_4px_12px_rgba(49,130,246,0.03)]'
                                : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                    >
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            (formData.is_recruiting === false && !formData.is_challenge) ? 'border-blue-600' : 'border-slate-300'
                        }`}>
                            {(formData.is_recruiting === false && !formData.is_challenge) && (
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
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
                        onClick={() => {
                            updateField('is_challenge', false);
                            updateField('is_recruiting', true);
                        }}
                        className={`p-4 rounded-2xl text-left border-2 transition-all duration-200 flex items-start gap-3 ${
                            (formData.is_recruiting === true && !formData.is_challenge)
                                ? 'border-blue-600 bg-blue-50/10 shadow-[0_4px_12px_rgba(49,130,246,0.03)]'
                                : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                    >
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            (formData.is_recruiting === true && !formData.is_challenge) ? 'border-blue-600' : 'border-slate-300'
                        }`}>
                            {(formData.is_recruiting === true && !formData.is_challenge) && (
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-800">신청 프로그램</p>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed">선착순 마감 등 사전 신청을 하고 승인받은 학생만 참여합니다.</p>
                        </div>
                    </button>

                    {/* Challenge Program Card */}
                    <button
                        type="button"
                        onClick={() => {
                            updateField('is_challenge', true);
                            updateField('is_recruiting', true);
                            updateField('max_capacity', '');
                        }}
                        className={`p-4 rounded-2xl text-left border-2 transition-all duration-200 flex items-start gap-3 ${
                            formData.is_challenge === true
                                ? 'border-blue-600 bg-blue-50/10 shadow-[0_4px_12px_rgba(49,130,246,0.03)]'
                                : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                    >
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            formData.is_challenge === true ? 'border-blue-600' : 'border-slate-300'
                        }`}>
                            {formData.is_challenge === true && (
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-800">챌린지 프로그램</p>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed">지정된 기간 동안 학생들이 미션을 수행하고 보상을 획득합니다.</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* 1. 진행 일정 카드 */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.015)] space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80">
                    <Calendar size={18} className="text-blue-600" />
                    <span className="text-sm font-bold text-slate-800">진행 일정 설정</span>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {formData.is_challenge ? (
                        // Challenge Program (Start Date & End Date)
                        <div className="space-y-1.5 lg:col-span-2">
                            <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">챌린지 진행 기간</label>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 relative h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                    <Calendar className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                                    <input
                                        type="date"
                                        value={formData.program_start_date || ''}
                                        onChange={e => updateField('program_start_date', e.target.value)}
                                        className="w-full h-full pl-10 pr-3 bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer"
                                        required
                                    />
                                </div>
                                <span className="text-slate-400 font-bold text-xs">~</span>
                                <div className="flex-1 relative h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                    <Calendar className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                                    <input
                                        type="date"
                                        value={formData.program_end_date || ''}
                                        onChange={e => updateField('program_end_date', e.target.value)}
                                        className="w-full h-full pl-10 pr-3 bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer"
                                        required
                                    />
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">챌린지가 진행되는 전체 기간입니다.</p>
                        </div>
                    ) : formData.is_recruiting ? (
                        // Recruiting Program (Single Date & Time & Duration)
                        <>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">프로그램 일시</label>
                                <div className="flex flex-col gap-2">
                                    <div className="relative h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                        <Calendar className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                                        <input
                                            type="date"
                                            value={splitDateTime(formData.program_date).date}
                                            onChange={e => {
                                                const newDate = joinDateTime(e.target.value, splitDateTime(formData.program_date).time);
                                                updateField('program_date', newDate);
                                                if (!formData.recruitment_deadline) {
                                                    const newRecDate = joinDateTime(e.target.value, splitDateTime(formData.recruitment_deadline).time);
                                                    updateField('recruitment_deadline', newRecDate);
                                                }
                                            }}
                                            className="w-full h-full pl-10 pr-3 bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer"
                                            required
                                        />
                                    </div>
                                    <div className="h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5">
                                        <Clock className="text-slate-400 shrink-0 mr-2" size={15} />
                                        <div className="flex-1 h-full">
                                            <IntuitiveTimePicker
                                                value={splitDateTime(formData.program_date).time}
                                                onChange={time => {
                                                    const newDate = joinDateTime(splitDateTime(formData.program_date).date, time);
                                                    updateField('program_date', newDate);
                                                    if (!formData.recruitment_deadline) {
                                                        const newRecDate = joinDateTime(splitDateTime(formData.recruitment_deadline).date, time);
                                                        updateField('recruitment_deadline', newRecDate);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">프로그램이 시작되는 날짜와 시간입니다.</p>
                            </div>

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
                                        required
                                    />
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">마감 시각 자동 계산 및 노출용 정보입니다.</p>
                            </div>
                        </>
                    ) : (
                        // Open Program (Start Date, End Date, Time & Days)
                        <>
                            <div className="space-y-1.5 lg:col-span-2">
                                <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">프로그램 기간 및 시간</label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 relative h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                            <Calendar className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                                            <input
                                                type="date"
                                                value={formData.program_start_date || ''}
                                                onChange={e => {
                                                    updateField('program_start_date', e.target.value);
                                                    const timePart = splitDateTime(formData.program_date).time;
                                                    updateField('program_date', joinDateTime(e.target.value, timePart));
                                                }}
                                                className="w-full h-full pl-10 pr-3 bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer"
                                                required
                                            />
                                        </div>
                                        <span className="text-slate-400 font-bold text-xs shrink-0 px-1">~</span>
                                        <div className="flex-1 relative h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                            <Calendar className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                                            <input
                                                type="date"
                                                value={formData.program_end_date || ''}
                                                onChange={e => updateField('program_end_date', e.target.value)}
                                                className="w-full h-full pl-10 pr-3 bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5">
                                        <Clock className="text-slate-400 shrink-0 mr-2" size={15} />
                                        <div className="flex-1 h-full">
                                            <IntuitiveTimePicker
                                                value={splitDateTime(formData.program_date).time}
                                                onChange={time => {
                                                    const datePart = formData.program_start_date || splitDateTime(formData.program_date).date;
                                                    const newDate = joinDateTime(datePart, time);
                                                    updateField('program_date', newDate);
                                                }}
                                            />
                                        </div>
                                    </div>
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
                                            required
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

            {/* 2. 장소 및 모집 설정 카드 */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.015)] space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80">
                    <MapPin size={18} className="text-blue-600" />
                    <span className="text-sm font-bold text-slate-800">장소 및 모집 관리</span>
                </div>

                <div className="space-y-4">
                    {/* 진행 장소 드롭다운 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">진행 장소</label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 h-11 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5">
                                <MapPin className="text-slate-400 shrink-0 mr-2" size={15} />
                                <select
                                    value={localMain}
                                    onChange={handleMainChange}
                                    className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer appearance-none"
                                    required
                                >
                                    <option value="">공간 선택</option>
                                    <option value="하이픈">하이픈</option>
                                    <option value="이높플레이스">이높플레이스</option>
                                    <option value="기타">기타</option>
                                </select>
                            </div>

                            {localMain === '하이픈' && (
                                <div className="flex-1 h-11 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5 animate-fade-in">
                                    <MapPin className="text-slate-400 shrink-0 mr-2" size={15} />
                                    <select
                                        value={selectedDetail}
                                        onChange={handleDetailChange}
                                        className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer appearance-none"
                                        required
                                    >
                                        <option value="">세부 공간 선택</option>
                                        {HAIFN_DETAILS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {localMain === '기타' && (
                                <div className="flex-1 h-11 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5 animate-fade-in">
                                    <MapPin className="text-slate-400 shrink-0 mr-2" size={15} />
                                    <input
                                        type="text"
                                        placeholder="예: 오아센터 (자유롭게 입력)"
                                        value={customVal}
                                        onChange={handleCustomChange}
                                        className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs placeholder:text-slate-400"
                                        required
                                    />
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">
                            {localMain === '하이픈' && "공간 이름 - 세부 공간 이름 순으로 표기됩니다. (예: '하이픈 B1F STAGE')"}
                            {localMain === '이높플레이스' && "공간 이름만 표기됩니다. (예: '이높플레이스')"}
                            {localMain === '기타' && "입력하신 텍스트가 그대로 표기됩니다. (예: '오아센터')"}
                            {!localMain && "공간 유형을 선택해 주세요."}
                        </p>
                    </div>

                    {/* 모집 정원 및 마감 시간 (신청 프로그램만 노출) */}
                    {formData.is_recruiting && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-slate-100/60">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">모집 정원</label>
                                <div className="relative h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                    <Users className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                                    <input
                                        type="number"
                                        placeholder="예: 10 (0: 무제한)"
                                        value={formData.max_capacity}
                                        onChange={e => updateField('max_capacity', e.target.value)}
                                        className="w-full h-full pl-10 pr-3.5 bg-transparent outline-none font-bold text-slate-800 text-xs"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">0을 입력하면 신청 인원 제한이 해제됩니다.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">신청 마감 시간</label>
                                <div className="flex flex-col gap-2">
                                    <div className="relative h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                        <Calendar className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                                        <input
                                            type="date"
                                            value={splitDateTime(formData.recruitment_deadline).date}
                                            onChange={e => {
                                                const newDate = joinDateTime(e.target.value, splitDateTime(formData.recruitment_deadline).time);
                                                updateField('recruitment_deadline', newDate);
                                            }}
                                            className="w-full h-full pl-10 pr-3.5 bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer"
                                        />
                                    </div>
                                    <div className="h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5">
                                        <Clock className="text-slate-400 shrink-0 mr-2" size={15} />
                                        <div className="flex-1 h-full">
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
                                <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">미지정 시 프로그램 시작 시각에 자동으로 마감됩니다.</p>
                            </div>

                            {/* 비공개 여부 */}
                            <div 
                                className={`lg:col-span-2 flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer select-none transition-all duration-200 ${
                                    formData.is_private 
                                        ? 'bg-blue-50/10 border-blue-500/20 text-blue-600 shadow-[0_4px_12px_rgba(49,130,246,0.01)]' 
                                        : 'bg-slate-50 border-slate-200/60 text-slate-500 hover:bg-slate-100/50'
                                }`}
                                onClick={() => updateField('is_private', !formData.is_private)}
                            >
                                <input
                                    type="checkbox"
                                    checked={formData.is_private || false}
                                    onChange={() => {}} // handled by click wrapper
                                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer mt-0.5 shrink-0"
                                />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-800">비공개 프로그램 설정</span>
                                    <span className="text-[10px] text-slate-400 font-semibold mt-0.5">공유 링크를 가지고 있는 대상자만 접근 및 신청이 가능합니다.</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. 비회원(게스트) 신청 설정 카드 */}
            {formData.is_recruiting && (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.015)] space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80">
                        <Users size={18} className="text-blue-600" />
                        <span className="text-sm font-bold text-slate-800">비회원(게스트) 신청 설정</span>
                    </div>

                    <div className="space-y-4">
                        <div 
                            className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer select-none transition-all duration-200 ${
                                formData.guest_properties?.allow_guest !== false 
                                    ? 'bg-blue-50/10 border-blue-500/20 text-blue-600 shadow-[0_4px_12px_rgba(49,130,246,0.01)] text-blue-600 shadow-[0_4px_12px_rgba(49,130,246,0.01)]' 
                                    : 'bg-slate-50 border-slate-200/60 text-slate-500 hover:bg-slate-100/50'
                            }`}
                            onClick={() => {
                                const gp = formData.guest_properties || { allow_guest: true, require_school: true, require_phone: true };
                                updateField('guest_properties', { ...gp, allow_guest: !gp.allow_guest });
                            }}
                        >
                            <input 
                                type="checkbox" 
                                checked={formData.guest_properties?.allow_guest !== false} 
                                onChange={() => {}} // handled by click wrapper
                                className="w-4 h-4 text-blue-600 rounded cursor-pointer mt-0.5 shrink-0" 
                            />
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800">로그인 없이 비회원(게스트) 신청 허용</span>
                                <span className="text-[10px] text-slate-400 font-semibold mt-0.5">비회원도 링크를 통해 이름 등을 기입하여 즉시 신청할 수 있습니다.</span>
                            </div>
                        </div>

                        {formData.guest_properties?.allow_guest !== false && (
                            <div className="pl-2 space-y-2.5 animate-fade-in">
                                <span className="text-[10px] font-bold text-slate-400 ml-1 block uppercase tracking-wider">수집할 개인 정보 항목</span>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="flex items-center gap-2 p-3 bg-slate-50/50 border border-slate-200/40 rounded-xl opacity-60">
                                        <User className="text-slate-400 mr-1.5" size={14} />
                                        <span className="text-xs font-bold text-slate-500">이름 (필수)</span>
                                    </div>

                                    <div 
                                        className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${
                                            formData.guest_properties?.require_school !== false 
                                                ? 'bg-blue-50/10 border-blue-500/20 text-blue-600 font-semibold' 
                                                : 'bg-slate-50/50 border-slate-200/40 text-slate-500 hover:bg-slate-100/50'
                                        }`}
                                        onClick={() => {
                                            const gp = formData.guest_properties || { allow_guest: true, require_school: true, require_phone: true };
                                            updateField('guest_properties', { ...gp, require_school: !gp.require_school });
                                        }}
                                    >
                                        <School className="mr-1.5" size={14} />
                                        <span className="text-xs font-bold">학교 / 소속</span>
                                    </div>

                                    <div 
                                        className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${
                                            formData.guest_properties?.require_phone !== false 
                                                ? 'bg-blue-50/10 border-blue-500/20 text-blue-600 font-semibold' 
                                                : 'bg-slate-50/50 border-slate-200/40 text-slate-500 hover:bg-slate-100/50'
                                        }`}
                                        onClick={() => {
                                            const gp = formData.guest_properties || { allow_guest: true, require_school: true, require_phone: true };
                                            updateField('guest_properties', { ...gp, require_phone: !gp.require_phone });
                                        }}
                                    >
                                        <Smartphone className="mr-1.5" size={14} />
                                        <span className="text-xs font-bold">연락처</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 4. 지급 포인트 및 리뷰 설정 카드 */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.015)] space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80">
                    <Gift size={18} className="text-blue-600" />
                    <span className="text-sm font-bold text-slate-800">지급 포인트 및 리뷰 설정</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">지급 포인트</label>
                        <div className="relative h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                            <Gift className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                            <input
                                type="number"
                                placeholder="단위: 하이픈 (지급 포인트)"
                                min="0"
                                value={formData.haifn_reward || ''}
                                onChange={e => updateField('haifn_reward', e.target.value)}
                                className="w-full h-full pl-10 pr-3.5 bg-transparent outline-none font-bold text-slate-800 text-xs"
                            />
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">프로그램 참여 완료 시 학생에게 지급되는 HP(하이픈 포인트)입니다.</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">후기 등록 조건</label>
                        <div 
                            className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer select-none transition-all duration-200 ${
                                formData.is_review_required 
                                    ? 'bg-blue-50/10 border-blue-500/20 text-blue-600 shadow-[0_4px_12px_rgba(49,130,246,0.01)]' 
                                    : 'bg-slate-50 border-slate-200/60 text-slate-500 hover:bg-slate-100/50'
                            }`}
                            onClick={() => updateField('is_review_required', !formData.is_review_required)}
                        >
                            <input
                                type="checkbox"
                                checked={formData.is_review_required || false}
                                onChange={() => {}} // handled by click wrapper
                                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer mt-0.5 shrink-0"
                            />
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800">리뷰(인증후기) 필수 작성</span>
                                <span className="text-[10px] font-semibold text-slate-400 mt-0.5">인증/후기가 완료되어야 포인트가 최종 지급됩니다.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Host settings: conditionally visible for CENTER programs */}
            {(!formData.program_type || formData.program_type === 'CENTER') && (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.015)] space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80">
                        <Users size={18} className="text-blue-600" />
                        <span className="text-sm font-bold text-slate-800">호스트 설정</span>
                    </div>

                    <div className="space-y-4">
                        {/* Dynamic Multi-Host Settings */}
                        {(() => {
                            const currentHosts = (formData.hosts && Array.isArray(formData.hosts)) && formData.hosts.length > 0
                                ? formData.hosts
                                : [{ host_id: formData.host_id || '', one_liner: formData.host_one_liner || '' }];
                            return (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {currentHosts.map((host, index) => (
                                            <div key={index} className="bg-white border border-slate-200/60 rounded-2xl p-5 space-y-3.5 relative transition-all hover:border-blue-500/20 shadow-sm">
                                                <div className="flex justify-between items-center pb-2 border-b border-slate-200/40">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-extrabold text-[11px] text-slate-500">호스트 #{index + 1}</span>
                                                        <div className="flex gap-0.5">
                                                            <button
                                                                type="button"
                                                                disabled={index === 0}
                                                                onClick={() => {
                                                                    if (index === 0) return;
                                                                    const nextHosts = [...currentHosts];
                                                                    const temp = nextHosts[index];
                                                                    nextHosts[index] = nextHosts[index - 1];
                                                                    nextHosts[index - 1] = temp;
                                                                    updateField('hosts', nextHosts);
                                                                }}
                                                                className={`p-0.5 rounded hover:bg-slate-200/80 transition ${index === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500'}`}
                                                                title="위로 이동"
                                                            >
                                                                <ChevronUp size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={index === currentHosts.length - 1}
                                                                onClick={() => {
                                                                    if (index === currentHosts.length - 1) return;
                                                                    const nextHosts = [...currentHosts];
                                                                    const temp = nextHosts[index];
                                                                    nextHosts[index] = nextHosts[index + 1];
                                                                    nextHosts[index + 1] = temp;
                                                                    updateField('hosts', nextHosts);
                                                                }}
                                                                className={`p-0.5 rounded hover:bg-slate-200/80 transition ${index === currentHosts.length - 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500'}`}
                                                                title="아래로 이동"
                                                            >
                                                                <ChevronDown size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {currentHosts.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const nextHosts = currentHosts.filter((_, i) => i !== index);
                                                                updateField('hosts', nextHosts);
                                                            }}
                                                            className="text-[10px] font-black text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100/80 px-2 py-1 rounded-lg transition-colors"
                                                        >
                                                            삭제
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="space-y-3">
                                                    {/* Host Selector */}
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">호스트 지정</label>
                                                        <div className="h-11 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5">
                                                            <Users className="text-slate-400 shrink-0 mr-2" size={15} />
                                                            <select
                                                                value={host.host_id || ''}
                                                                onChange={e => {
                                                                    const nextHosts = [...currentHosts];
                                                                    nextHosts[index] = { ...nextHosts[index], host_id: e.target.value };
                                                                    updateField('hosts', nextHosts);
                                                                }}
                                                                className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer"
                                                            >
                                                                <option value="">호스트 선택</option>
                                                                {admins.map(admin => {
                                                                    const hasNoSchoolOrHaifn = !admin.school || admin.school === '더작은재단';
                                                                    const optionText = hasNoSchoolOrHaifn ? admin.name : `${admin.name} (${admin.school})`;
                                                                    return (
                                                                        <option key={admin.id} value={admin.id}>
                                                                            {optionText}
                                                                        </option>
                                                                    );
                                                                })}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Host One-liner */}
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">호스트 한마디</label>
                                                        <div className="h-11 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5">
                                                            <MessageSquare className="text-slate-400 shrink-0 mr-2" size={15} />
                                                            <input
                                                                type="text"
                                                                placeholder="호스트의 다짐이나 한마디를 입력해주세요."
                                                                value={host.one_liner || ''}
                                                                onChange={e => {
                                                                    const nextHosts = [...currentHosts];
                                                                    nextHosts[index] = { ...nextHosts[index], one_liner: e.target.value };
                                                                    updateField('hosts', nextHosts);
                                                                }}
                                                                className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextHosts = [...currentHosts, { host_id: '', one_liner: '' }];
                                            updateField('hosts', nextHosts);
                                        }}
                                        className="w-full py-3.5 border border-dashed border-slate-200 hover:border-blue-500 rounded-2xl font-bold text-slate-500 hover:text-blue-600 bg-slate-50/30 hover:bg-blue-50/5 transition-all text-xs flex items-center justify-center gap-1.5"
                                    >
                                        + 호스트 추가
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium ml-1">
                        센터 프로그램으로 진행할 때 해당 프로그램을 책임지고 운영할 호스트를 설정합니다.
                    </p>
                </div>
            )}

            {/* 6. 챌린지 미션 설정 카드 */}
            {formData.is_challenge && (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.015)] space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80">
                        <Target size={18} className="text-blue-600" />
                        <span className="text-sm font-bold text-slate-800">챌린지 미션 설정</span>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {(formData.challenge_missions || []).map((mission, index) => {
                                const showCustomLoc = mission.location_type === 'custom' || (!['', '이높플레이스', ...HAIFN_DETAILS.map(d => `하이픈 ${d}`)].includes(mission.location) && mission.location);
                                return (
                                    <div key={mission.id || index} className="bg-white border border-slate-200/60 rounded-2xl p-5 space-y-3.5 relative transition-all hover:border-blue-500/20 shadow-sm animate-fade-in">
                                        <div className="flex justify-between items-center pb-2 border-b border-slate-200/40">
                                            <span className="font-extrabold text-xs text-slate-600">미션 {index + 1}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = (formData.challenge_missions || []).filter((_, idx) => idx !== index);
                                                    updateField('challenge_missions', updated);
                                                }}
                                                className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                                            >
                                                <Trash size={14} />
                                            </button>
                                        </div>

                                        <div className="space-y-3.5">
                                            {/* Title */}
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">미션명</label>
                                                <div className="h-11 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5">
                                                    <Bookmark className="text-slate-400 shrink-0 mr-2" size={15} />
                                                    <input
                                                        type="text"
                                                        placeholder="예: 보드게임 참여하기"
                                                        value={mission.title || ''}
                                                        onChange={(e) => {
                                                            const updated = [...(formData.challenge_missions || [])];
                                                            updated[index] = { ...updated[index], title: e.target.value };
                                                            updateField('challenge_missions', updated);
                                                        }}
                                                        className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs placeholder:text-slate-400"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            {/* Location */}
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">진행 장소</label>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <div className="flex-1 h-11 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5">
                                                        <MapPin className="text-slate-400 shrink-0 mr-2" size={15} />
                                                        <select
                                                            value={mission.location_type || (mission.location ? (mission.location === '이높플레이스' || HAIFN_DETAILS.some(d => `하이픈 ${d}`) ? mission.location : 'custom') : '')}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                const updated = [...(formData.challenge_missions || [])];
                                                                updated[index] = { 
                                                                    ...updated[index], 
                                                                    location_type: val,
                                                                    location: val === 'custom' ? '' : val 
                                                                };
                                                                updateField('challenge_missions', updated);
                                                            }}
                                                            className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer appearance-none"
                                                        >
                                                            <option value="">장소 선택 안함</option>
                                                            {HAIFN_DETAILS.map(d => (
                                                                <option key={d} value={`하이픈 ${d}`}>하이픈 {d}</option>
                                                            ))}
                                                            <option value="이높플레이스">이높플레이스</option>
                                                            <option value="custom">기타 (직접 입력)</option>
                                                        </select>
                                                    </div>

                                                    {(mission.location_type === 'custom' || showCustomLoc) && (
                                                        <div className="flex-1 h-11 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5">
                                                            <MapPin className="text-slate-400 shrink-0 mr-2" size={15} />
                                                            <input
                                                                type="text"
                                                                placeholder="예: 센터 외부"
                                                                value={mission.location || ''}
                                                                onChange={(e) => {
                                                                    const updated = [...(formData.challenge_missions || [])];
                                                                    updated[index] = { ...updated[index], location: e.target.value };
                                                                    updateField('challenge_missions', updated);
                                                                }}
                                                                className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs placeholder:text-slate-400"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Description */}
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">세부 내용</label>
                                                <textarea
                                                    placeholder="미션 수행을 위한 상세 가이드를 적어주세요 (옵션)"
                                                    value={mission.description || ''}
                                                    onChange={(e) => {
                                                        const updated = [...(formData.challenge_missions || [])];
                                                        updated[index] = { ...updated[index], description: e.target.value };
                                                        updateField('challenge_missions', updated);
                                                    }}
                                                    rows={2}
                                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/60 rounded-xl outline-none font-bold text-slate-800 text-xs focus:border-blue-600 focus:bg-white transition-all resize-none placeholder:text-slate-400"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                const newMission = { id: `m-${Date.now()}-${Math.random()}`, title: '' };
                                updateField('challenge_missions', [...(formData.challenge_missions || []), newMission]);
                            }}
                            className="w-full py-3.5 bg-slate-50 border border-dashed border-slate-200 hover:border-blue-500 rounded-2xl font-bold text-slate-500 hover:text-blue-600 transition-all text-xs flex items-center justify-center gap-1.5 shadow-sm"
                        >
                            + 미션 추가
                        </button>
                    </div>

                    <div className="pt-4 border-t border-slate-100 space-y-2">
                        <label className="text-xs font-bold text-slate-500 mb-1 block">챌린지 완료 축하/안내 메시지</label>
                        <div className="relative bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all p-3">
                            <textarea
                                value={formData.challenge_success_message || ''}
                                onChange={e => updateField('challenge_success_message', e.target.value)}
                                placeholder="축하합니다! 모든 미션을 완료하여 챌린지를 성공적으로 마치셨습니다! (완료 시 팝업 창에 표시됩니다.)"
                                className="w-full h-20 bg-transparent outline-none font-bold text-slate-800 text-xs resize-none"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">참여자가 모든 챌린지 미션 인증을 성공했을 때 화면에 노출되는 축하 팝업 메시지 내용입니다.</p>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="challenge_show_hyphen_btn"
                            checked={formData.challenge_show_hyphen_btn || false}
                            onChange={e => updateField('challenge_show_hyphen_btn', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="challenge_show_hyphen_btn" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                            성공 팝업 창에 '하이픈 등록' 버튼 노출하기 (게스트 참여자 대상)
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
};

ProgramInfoSection.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
    flat: PropTypes.bool
};

export default React.memo(ProgramInfoSection);
