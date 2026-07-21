import React from 'react';
import PropTypes from 'prop-types';
import IntuitiveTimePicker from '../../../../common/IntuitiveTimePicker';
import { splitDateTime, joinDateTime } from '../../utils/noticeHelpers';
import { PROGRAM_TYPES } from '../../utils/constants';
import { Calendar, Clock, MapPin, Gift, CheckSquare, Users, ChevronUp, ChevronDown, MessageSquare, Target, Trash, Bookmark, User, School, Smartphone, Sparkles, ToggleLeft, ToggleRight, HelpCircle, Dices } from 'lucide-react';
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
    // Single Source of Truth for Host Active State
    const isHostActive = formData.enable_hosts === true;

    // Cache last hosts to restore if user toggles off/on
    const savedHostsRef = React.useRef(
        (Array.isArray(formData.hosts) && formData.hosts.length > 0)
            ? formData.hosts
            : (formData.host_id ? [{ host_id: formData.host_id, one_liner: formData.host_one_liner || '' }] : [])
    );

    React.useEffect(() => {
        if (Array.isArray(formData.hosts) && formData.hosts.length > 0) {
            savedHostsRef.current = formData.hosts;
        }
    }, [formData.hosts]);

    const [openSections, setOpenSections] = React.useState({
        guest: formData.guest_properties?.allow_guest !== false,
        reward: Number(formData.haifn_reward) > 0
    });

    const toggleSection = (key) => {
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    };
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
{/* 3. 비회원(게스트) 신청 설정 (아코디언 카드) */}
            {formData.is_recruiting && (
                <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
                    formData.guest_properties?.allow_guest !== false ? 'border-blue-300 shadow-md' : 'border-slate-200/80 hover:border-slate-300'
                }`}>
                    <button
                        type="button"
                        onClick={() => {
                            const isCurrentlyAllowed = formData.guest_properties?.allow_guest !== false;
                            const nextState = !isCurrentlyAllowed;
                            const gp = formData.guest_properties || { allow_guest: true, require_school: true, require_phone: true };
                            updateField('guest_properties', { ...gp, allow_guest: nextState });
                            setOpenSections(prev => ({ ...prev, guest: nextState }));
                        }}
                        className="w-full p-4 sm:p-5 flex items-center justify-between bg-white hover:bg-slate-50/60 transition-colors cursor-pointer select-none"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl transition-colors ${
                                formData.guest_properties?.allow_guest !== false ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                            }`}>
                                <Users size={18} />
                            </div>
                            <div className="flex flex-col items-start text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-slate-800">비회원(게스트) 신청 설정</span>
                                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                                        formData.guest_properties?.allow_guest !== false ? 'bg-blue-50 text-blue-600 border-blue-200/60' : 'bg-slate-100 text-slate-500 border-slate-200/60'
                                    }`}>
                                        {formData.guest_properties?.allow_guest !== false ? '게스트 허용 (활성화)' : '미사용 (비활성화)'}
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-medium mt-0.5">로그인 없이 참여할 수 있는 비회원 신청 옵션입니다.</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {formData.guest_properties?.allow_guest !== false ? (
                                <ToggleRight size={28} className="text-blue-600" />
                            ) : (
                                <ToggleLeft size={28} className="text-slate-300" />
                            )}
                            {formData.guest_properties?.allow_guest !== false ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                        </div>
                    </button>

                    {formData.guest_properties?.allow_guest !== false && (
                        <div className="p-5 pt-3 border-t border-slate-100 bg-slate-50/40 space-y-3 animate-fade-in">
                            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">수집할 개인 정보 항목 선택</span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div className="flex items-center gap-2 p-3 bg-white border border-slate-200/60 rounded-xl opacity-70">
                                    <User className="text-slate-400 shrink-0" size={15} />
                                    <span className="text-xs font-bold text-slate-600">이름 (필수 수집)</span>
                                </div>

                                <div 
                                    className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${
                                        formData.guest_properties?.require_school !== false 
                                            ? 'bg-blue-50/60 border-blue-400 text-blue-700 font-bold' 
                                            : 'bg-white border-slate-200/60 text-slate-400 hover:bg-slate-50'
                                    }`}
                                    onClick={() => {
                                        const gp = formData.guest_properties || { allow_guest: true, require_school: true, require_phone: true };
                                        updateField('guest_properties', { ...gp, require_school: !gp.require_school });
                                    }}
                                >
                                    <School className="shrink-0" size={15} />
                                    <span className="text-xs font-bold">학교 / 소속</span>
                                </div>

                                <div 
                                    className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${
                                        formData.guest_properties?.require_phone !== false 
                                            ? 'bg-blue-50/60 border-blue-400 text-blue-700 font-bold' 
                                            : 'bg-white border-slate-200/60 text-slate-400 hover:bg-slate-50'
                                    }`}
                                    onClick={() => {
                                        const gp = formData.guest_properties || { allow_guest: true, require_school: true, require_phone: true };
                                        updateField('guest_properties', { ...gp, require_phone: !gp.require_phone });
                                    }}
                                >
                                    <Smartphone className="shrink-0" size={15} />
                                    <span className="text-xs font-bold">연락처</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 4. 지급 포인트 및 리뷰 설정 (아코디언 카드) */}
            <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
                Number(formData.haifn_reward) > 0 ? 'border-blue-300 shadow-md' : 'border-slate-200/80 hover:border-slate-300'
            }`}>
                <button
                    type="button"
                    onClick={() => {
                        const hasReward = Number(formData.haifn_reward) > 0;
                        if (hasReward) {
                            updateField('haifn_reward', 0);
                            updateField('is_review_required', false);
                            setOpenSections(prev => ({ ...prev, reward: false }));
                        } else {
                            updateField('haifn_reward', 5);
                            setOpenSections(prev => ({ ...prev, reward: true }));
                        }
                    }}
                    className="w-full p-4 sm:p-5 flex items-center justify-between bg-white hover:bg-slate-50/60 transition-colors cursor-pointer select-none"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl transition-colors ${
                            Number(formData.haifn_reward) > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                            <Gift size={18} />
                        </div>
                        <div className="flex flex-col items-start text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-slate-800">지급 포인트 및 리뷰 설정</span>
                                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                                    Number(formData.haifn_reward) > 0 ? 'bg-blue-50 text-blue-600 border-blue-200/60' : 'bg-slate-100 text-slate-500 border-slate-200/60'
                                }`}>
                                    {Number(formData.haifn_reward) > 0 ? `${formData.haifn_reward} HP 지급 (활성화)` : '미사용 (비활성화)'}
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-medium mt-0.5">참여 완료 시 학생에게 포인트를 지급하고 후기를 수집합니다.</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {Number(formData.haifn_reward) > 0 ? (
                            <ToggleRight size={28} className="text-blue-600" />
                        ) : (
                            <ToggleLeft size={28} className="text-slate-300" />
                        )}
                        {Number(formData.haifn_reward) > 0 ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </div>
                </button>

                {Number(formData.haifn_reward) > 0 && (
                    <div className="p-5 pt-3 border-t border-slate-100 bg-slate-50/40 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 mb-1.5 block">지급 포인트 (HP)</label>
                            <div className="relative h-11 flex items-center bg-white border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 transition-all">
                                <Gift className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                                <input
                                    type="number"
                                    placeholder="단위: 하이픈 (지급 포인트)"
                                    min="1"
                                    value={formData.haifn_reward || ''}
                                    onChange={e => updateField('haifn_reward', e.target.value)}
                                    className="w-full h-full pl-10 pr-3.5 bg-transparent outline-none font-bold text-slate-800 text-xs"
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-1.5 block leading-normal">프로그램 참여 완료 시 지급되는 하이픈 포인트입니다.</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 mb-1.5 block">후기 등록 조건</label>
                            <div 
                                className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer select-none transition-all duration-200 ${
                                    formData.is_review_required 
                                        ? 'bg-blue-50/60 border-blue-400 text-blue-700' 
                                        : 'bg-white border-slate-200/60 text-slate-500 hover:bg-slate-50'
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
                )}
            </div>

            {/* 5. 호스트 설정 (아코디언 카드) */}
            {(!formData.program_type || formData.program_type === 'CENTER') && (
                <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
                    isHostActive ? 'border-blue-300 shadow-md' : 'border-slate-200/80 hover:border-slate-300'
                }`}>
                    <button
                        type="button"
                        onClick={() => {
                            const nextState = !isHostActive;
                            if (!nextState) {
                                if (Array.isArray(formData.hosts) && formData.hosts.length > 0) {
                                    savedHostsRef.current = formData.hosts;
                                }
                                updateField('enable_hosts', false);
                            } else {
                                updateField('enable_hosts', true);
                                const hostsToRestore = (savedHostsRef.current && Array.isArray(savedHostsRef.current) && savedHostsRef.current.length > 0)
                                    ? savedHostsRef.current
                                    : [{ host_id: formData.host_id || '', one_liner: formData.host_one_liner || '' }];
                                updateField('hosts', hostsToRestore);
                                if (hostsToRestore[0]?.host_id) {
                                    updateField('host_id', hostsToRestore[0].host_id);
                                    updateField('host_one_liner', hostsToRestore[0].one_liner || '');
                                }
                            }
                        }}
                        className="w-full p-4 sm:p-5 flex items-center justify-between bg-white hover:bg-slate-50/60 transition-colors cursor-pointer select-none"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl transition-colors ${
                                isHostActive ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                            }`}>
                                <Users size={18} />
                            </div>
                            <div className="flex flex-col items-start text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-slate-800">호스트(진행자) 설정</span>
                                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                                        isHostActive ? 'bg-blue-50 text-blue-600 border-blue-200/60' : 'bg-slate-100 text-slate-500 border-slate-200/60'
                                    }`}>
                                        {isHostActive ? '호스트 지정 (활성화)' : '미사용 (비활성화)'}
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-medium mt-0.5">프로그램을 담당하여 진행할 전담 호스트를 지정합니다.</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {isHostActive ? (
                                <ToggleRight size={28} className="text-blue-600" />
                            ) : (
                                <ToggleLeft size={28} className="text-slate-300" />
                            )}
                            {isHostActive ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                        </div>
                    </button>

                    {isHostActive && (
                        <div className="p-5 pt-3 border-t border-slate-100 bg-slate-50/40 space-y-4 animate-fade-in">
                            {(() => {
                                const currentHosts = (formData.hosts && Array.isArray(formData.hosts)) && formData.hosts.length > 0
                                    ? formData.hosts
                                    : [{ host_id: formData.host_id || '', one_liner: formData.host_one_liner || '' }];
                                return (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {currentHosts.map((host, index) => (
                                                <div key={index} className="bg-white border border-slate-200/60 rounded-xl p-4 space-y-3 relative transition-all hover:border-blue-400 shadow-sm">
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
                                                                    if (nextHosts[0]?.host_id) {
                                                                        updateField('host_id', nextHosts[0].host_id);
                                                                        updateField('host_one_liner', nextHosts[0].one_liner || '');
                                                                    }
                                                                }}
                                                                className="text-[10px] font-black text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100/80 px-2 py-1 rounded-lg transition-colors"
                                                            >
                                                                삭제
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-xs font-bold text-slate-500 mb-1 block">호스트 지정</label>
                                                            <div className="h-10 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3">
                                                                <Users className="text-slate-400 shrink-0 mr-2" size={14} />
                                                                <select
                                                                    value={host.host_id || ''}
                                                                    onChange={e => {
                                                                        const nextHosts = [...currentHosts];
                                                                        nextHosts[index] = { ...nextHosts[index], host_id: e.target.value };
                                                                        updateField('hosts', nextHosts);
                                                                        updateField('host_id', nextHosts[0]?.host_id || '');
                                                                        updateField('host_one_liner', nextHosts[0]?.one_liner || '');
                                                                    }}
                                                                    className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer"
                                                                >
                                                                    <option value="">호스트 선택</option>
                                                                    {(() => {
                                                                        const selectedInOtherCards = currentHosts
                                                                            .filter((_, i) => i !== index)
                                                                            .map(h => h.host_id)
                                                                            .filter(Boolean);
                                                                        const availableAdmins = admins.filter(a => !selectedInOtherCards.includes(a.id));
                                                                        return availableAdmins.map(admin => {
                                                                            const hasNoSchoolOrHaifn = !admin.school || admin.school === '더작은재단';
                                                                            const optionText = hasNoSchoolOrHaifn ? admin.name : `${admin.name} (${admin.school})`;
                                                                            return (
                                                                                <option key={admin.id} value={admin.id}>
                                                                                    {optionText}
                                                                                </option>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-xs font-bold text-slate-500 mb-1 block">호스트 한마디</label>
                                                            <div className="h-10 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3">
                                                                <MessageSquare className="text-slate-400 shrink-0 mr-2" size={14} />
                                                                <input
                                                                    type="text"
                                                                    placeholder="호스트의 다짐이나 한마디를 입력해주세요."
                                                                    value={host.one_liner || ''}
                                                                    onChange={e => {
                                                                        const nextHosts = [...currentHosts];
                                                                        nextHosts[index] = { ...nextHosts[index], one_liner: e.target.value };
                                                                        updateField('hosts', nextHosts);
                                                                        updateField('host_one_liner', nextHosts[0]?.one_liner || '');
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
                                            className="w-full py-3 border border-dashed border-slate-200 hover:border-blue-500 rounded-xl font-bold text-slate-500 hover:text-blue-600 bg-white hover:bg-blue-50/20 transition-all text-xs flex items-center justify-center gap-1.5"
                                        >
                                            + 호스트 추가
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {/* 6. 챌린지 미션 설정 카드 */}
            {formData.is_challenge && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                        <Target size={18} className="text-blue-600" />
                        <span className="text-sm font-bold text-slate-800">챌린지 미션 설정</span>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {(formData.challenge_missions || []).map((mission, index) => {
                                const showCustomLoc = mission.location_type === 'custom' || (!['', '이높플레이스', ...HAIFN_DETAILS.map(d => `하이픈 ${d}`)].includes(mission.location) && mission.location);
                                return (
                                    <div key={mission.id || index} className="bg-white border border-slate-200/60 rounded-xl p-4 space-y-3 relative transition-all hover:border-blue-400 shadow-sm animate-fade-in">
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

                                        <div className="space-y-3">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">미션명</label>
                                                <div className="h-10 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3">
                                                    <Bookmark className="text-slate-400 shrink-0 mr-2" size={14} />
                                                    <input
                                                        type="text"
                                                        placeholder="예: 보드게임 참여하기"
                                                        value={mission.title || ''}
                                                        onChange={(e) => {
                                                            const updated = [...(formData.challenge_missions || [])];
                                                            updated[index] = { ...updated[index], title: e.target.value };
                                                            updateField('challenge_missions', updated);
                                                        }}
                                                        className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">수행 장소</label>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <div className="flex-1 h-10 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3">
                                                        <MapPin className="text-slate-400 shrink-0 mr-2" size={14} />
                                                        <select
                                                            value={mission.location_type || (HAIFN_DETAILS.map(d => `하이픈 ${d}`).includes(mission.location) ? '하이픈' : (mission.location === '이높플레이스' ? '이높플레이스' : (mission.location ? 'custom' : '')))}
                                                            onChange={(e) => {
                                                                const type = e.target.value;
                                                                const updated = [...(formData.challenge_missions || [])];
                                                                if (type === '하이픈') {
                                                                    updated[index] = { ...updated[index], location_type: '하이픈', location: '하이픈 B1F STAGE' };
                                                                } else if (type === '이높플레이스') {
                                                                    updated[index] = { ...updated[index], location_type: '이높플레이스', location: '이높플레이스' };
                                                                } else {
                                                                    updated[index] = { ...updated[index], location_type: 'custom', location: '' };
                                                                }
                                                                updateField('challenge_missions', updated);
                                                            }}
                                                            className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer appearance-none"
                                                        >
                                                            <option value="">장소 선택</option>
                                                            <option value="하이픈">하이픈 (센터)</option>
                                                            <option value="이높플레이스">이높플레이스</option>
                                                            <option value="custom">기타 (직접 입력)</option>
                                                        </select>
                                                    </div>

                                                    {(mission.location_type === 'custom' || showCustomLoc) && (
                                                        <div className="flex-1 h-10 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3">
                                                            <MapPin className="text-slate-400 shrink-0 mr-2" size={14} />
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

                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">세부 내용</label>
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
                            className="w-full py-3 bg-slate-50 border border-dashed border-slate-200 hover:border-blue-500 rounded-xl font-bold text-slate-500 hover:text-blue-600 transition-all text-xs flex items-center justify-center gap-1.5 shadow-sm"
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
                                placeholder="축하합니다! 모든 미션을 완료하여 챌린지를 성공적으로 마치셨습니다!"
                                className="w-full h-20 bg-transparent outline-none font-bold text-slate-800 text-xs resize-none"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 7. 신청자 전용 맞춤 버튼 및 팝업 설정 (아코디언 카드) */}
            <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
                formData.enable_post_program_button ? 'border-blue-300 shadow-md' : 'border-slate-200/80 hover:border-slate-300'
            }`}>
                <button
                    type="button"
                    onClick={() => {
                        const nextState = !formData.enable_post_program_button;
                        updateField('enable_post_program_button', nextState);
                    }}
                    className="w-full p-4 sm:p-5 flex items-center justify-between bg-white hover:bg-slate-50/60 transition-colors cursor-pointer select-none"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl transition-colors ${
                            formData.enable_post_program_button ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                            <Sparkles size={18} />
                        </div>
                        <div className="flex flex-col items-start text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-slate-800">신청자 전용 맞춤 버튼 및 팝업 설정</span>
                                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                                    formData.enable_post_program_button ? 'bg-blue-50 text-blue-600 border-blue-200/60' : 'bg-slate-100 text-slate-500 border-slate-200/60'
                                }`}>
                                    {formData.enable_post_program_button ? '맞춤 버튼 사용 (활성화)' : '미사용 (비활성화)'}
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-medium mt-0.5">종료 또는 시작 시점에 신청자에게 노출될 맞춤 버튼을 설정합니다.</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {formData.enable_post_program_button ? (
                            <ToggleRight size={28} className="text-blue-600" />
                        ) : (
                            <ToggleLeft size={28} className="text-slate-300" />
                        )}
                        {formData.enable_post_program_button ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </div>
                </button>

                {formData.enable_post_program_button && (
                    <div className="p-5 pt-3 border-t border-slate-100 bg-slate-50/40 space-y-4 animate-fade-in">
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                            지정한 시점이 지난 후, 해당 프로그램을 신청했던 참가자들에게 노출될 맞춤 버튼 이름과 클릭 시 표시될 팝업 내용/링크를 작성할 수 있습니다.
                        </p>

                        <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-600 block">버튼 활성화 시점 선택</label>
                            <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-700">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="post_program_button_trigger"
                                        value="start_time"
                                        checked={(formData.post_program_button_trigger || 'start_time') === 'start_time'}
                                        onChange={e => updateField('post_program_button_trigger', e.target.value)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span>프로그램 시작 시간 기준</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="post_program_button_trigger"
                                        value="end_time"
                                        checked={formData.post_program_button_trigger === 'end_time'}
                                        onChange={e => updateField('post_program_button_trigger', e.target.value)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span>프로그램 종료/마감 시간 기준</span>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-600">버튼 이름 (선택)</label>
                                    <span className="text-[10px] font-semibold text-blue-600">
                                        {(() => {
                                            if (formData.post_program_button_name?.trim()) return '직접 입력한 이름 사용';
                                            const hasGroup = formData.enable_group_assignment;
                                            const hasQ = formData.enable_random_questions && formData.random_questions?.length > 0;
                                            if (hasGroup && hasQ) return '자동 설정: "조 배치 & 아이스브레이킹 🎲"';
                                            if (hasGroup) return '자동 설정: "나의 조 배치 확인 👥"';
                                            if (hasQ) return '자동 설정: "아이스브레이킹 질문 🎲"';
                                            return '미입력 시 "프로그램 안내"로 노출';
                                        })()}
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={formData.post_program_button_name || ''}
                                    onChange={e => updateField('post_program_button_name', e.target.value)}
                                    placeholder="비워두면 하단에서 선택한 기능(조 배치, 질문 등)에 맞게 자동 명명됩니다."
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200/60 rounded-xl outline-none font-bold text-slate-800 text-xs focus:border-blue-600 transition-all placeholder:text-slate-400"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-1 block">버튼 클릭 시 나타날 팝업 내용</label>
                                <textarea
                                    value={formData.post_program_button_content || ''}
                                    onChange={e => updateField('post_program_button_content', e.target.value)}
                                    placeholder="버튼을 눌렀을 때 학생들에게 전달할 안내 문구나 메시지를 입력하세요."
                                    rows={3}
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200/60 rounded-xl outline-none font-bold text-slate-800 text-xs focus:border-blue-600 transition-all resize-none placeholder:text-slate-400"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-1 block">연결할 외부 링크 (옵션)</label>
                                <input
                                    type="text"
                                    value={formData.post_program_button_link || ''}
                                    onChange={e => updateField('post_program_button_link', e.target.value)}
                                    placeholder="예: https://forms.google.com/... (링크 입력 시 팝업 창에 바로가기 버튼이 노출됩니다)"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200/60 rounded-xl outline-none font-bold text-slate-800 text-xs focus:border-blue-600 transition-all placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        {/* 조 배치 설정 카드 */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200/60 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users size={16} className="text-blue-600" />
                                    <span className="text-xs font-bold text-slate-800">랜덤 팀 배치</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => updateField('enable_group_assignment', !formData.enable_group_assignment)}
                                    className="cursor-pointer"
                                >
                                    {formData.enable_group_assignment ? (
                                        <ToggleRight size={24} className="text-blue-600" />
                                    ) : (
                                        <ToggleLeft size={24} className="text-slate-300" />
                                    )}
                                </button>
                            </div>

                            {formData.enable_group_assignment && (
                                <div className="pt-2 border-t border-slate-100 space-y-2.5 animate-fade-in">
                                    <p className="text-[11px] text-slate-400 font-medium">
                                        신청자들이 팝업을 열었을 때 본인의 조 배치 정보(예: 2조)를 확인할 수 있도록 안내합니다.
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs font-bold text-slate-600 shrink-0">총 조 개수 설정:</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="50"
                                            value={formData.group_count || 4}
                                            onChange={e => updateField('group_count', parseInt(e.target.value) || 1)}
                                            className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-lg outline-none font-bold text-slate-800 text-xs focus:border-blue-600"
                                        />
                                        <span className="text-xs font-bold text-slate-500">개 조 (무작위 랜덤 균등 자동 배치됩니다)</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 랜덤 질문 설정 카드 */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200/60 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Dices size={16} className="text-blue-600" />
                                    <span className="text-xs font-bold text-slate-800">랜덤 질문</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => updateField('enable_random_questions', !formData.enable_random_questions)}
                                    className="cursor-pointer"
                                >
                                    {formData.enable_random_questions ? (
                                        <ToggleRight size={24} className="text-blue-600" />
                                    ) : (
                                        <ToggleLeft size={24} className="text-slate-300" />
                                    )}
                                </button>
                            </div>

                            {formData.enable_random_questions && (
                                <div className="pt-2 border-t border-slate-100 space-y-3 animate-fade-in">
                                    <p className="text-[11px] text-slate-400 font-medium">
                                        팝업 모달에 '🎲 다른 질문 뽑기' 버튼이 노출되며 아래 등록한 질문들이 무작위로 나타납니다.
                                    </p>
                                    
                                    {/* 질문 목록 */}
                                    <div className="space-y-2">
                                        {(formData.random_questions || []).map((q, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200/40">
                                                <span className="text-xs font-bold text-blue-600 shrink-0 w-6 text-center">Q{idx + 1}.</span>
                                                <input
                                                    type="text"
                                                    value={q}
                                                    onChange={e => {
                                                        const updated = [...(formData.random_questions || [])];
                                                        updated[idx] = e.target.value;
                                                        updateField('random_questions', updated);
                                                    }}
                                                    placeholder="신규 질문을 입력하세요"
                                                    className="w-full bg-transparent outline-none text-xs font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const updated = (formData.random_questions || []).filter((_, i) => i !== idx);
                                                        updateField('random_questions', updated);
                                                    }}
                                                    className="text-[10px] font-black text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors shrink-0"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 질문 추가 버튼 */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updated = [...(formData.random_questions || []), ''];
                                            updateField('random_questions', updated);
                                        }}
                                        className="w-full py-2 bg-slate-50 hover:bg-blue-50/20 border border-dashed border-slate-200 hover:border-blue-400 rounded-xl font-bold text-slate-500 hover:text-blue-600 transition-all text-xs flex items-center justify-center gap-1"
                                    >
                                        + 질문 추가하기
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
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
