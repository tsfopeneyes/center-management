import React from 'react';
import PropTypes from 'prop-types';
import { MapPin, Users } from 'lucide-react';
import RecruitmentPeriodFields from '../../../components/admin/board/components/forms/RecruitmentPeriodFields';
import { HAIFN_DETAILS } from './programLocationOptions';

const LocationRecruitmentSettings = ({ formData, updateField, isScheduledRegistration }) => {
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
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.015)] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80">
                <MapPin size={18} className="text-blue-600" />
                <span className="text-sm font-bold text-slate-800">장소 및 모집 관리</span>
            </div>

            <div className={formData.is_recruiting ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-4'}>
                {/* 진행 장소 드롭다운 */}
                {!(formData.is_challenge && formData.challenge_format === 'ONLINE') && <div className="min-w-0 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">진행 장소</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 min-w-0 min-h-11 h-11 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5">
                            <MapPin className="text-slate-400 shrink-0 mr-2" size={15} />
                            <select
                                aria-label="진행 장소"
                                value={localMain}
                                onChange={handleMainChange}
                                className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer appearance-none"
                                required={!isScheduledRegistration}
                            >
                                <option value="">공간 선택</option>
                                <option value="하이픈">하이픈</option>
                                <option value="이높플레이스">이높플레이스</option>
                                <option value="기타">기타</option>
                            </select>
                        </div>

                        {localMain === '하이픈' && (
                            <div className="flex-1 min-w-0 min-h-11 h-11 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5 animate-fade-in">
                                <MapPin className="text-slate-400 shrink-0 mr-2" size={15} />
                                <select
                                    aria-label="세부 공간"
                                    value={selectedDetail}
                                    onChange={handleDetailChange}
                                    className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer appearance-none"
                                    required={!isScheduledRegistration}
                                >
                                    <option value="">세부 공간 선택</option>
                                    {HAIFN_DETAILS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {localMain === '기타' && (
                            <div className="flex-1 min-w-0 min-h-11 h-11 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3.5 animate-fade-in">
                                <MapPin className="text-slate-400 shrink-0 mr-2" size={15} />
                                <input
                                    type="text"
                                    placeholder="예: 오아센터 (자유롭게 입력)"
                                    value={customVal}
                                    onChange={handleCustomChange}
                                    className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs placeholder:text-slate-400"
                                    required={!isScheduledRegistration}
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
                </div>}

                {/* 장소 옆의 정원, 아래 전체 너비의 모집 기간 (신청 프로그램만 노출) */}
                {formData.is_recruiting && (
                    <>
                        <div className="min-w-0 space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block">모집 정원</label>
                            <div className="relative h-11 flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                                <Users className="absolute left-3.5 text-slate-400 shrink-0" size={15} />
                                <input
                                    type="number"
                                    aria-label="모집 정원"
                                    placeholder="예: 10 (0: 무제한)"
                                    value={formData.max_capacity}
                                    onChange={e => updateField('max_capacity', e.target.value)}
                                    className="w-full h-full pl-10 pr-3.5 bg-transparent outline-none font-bold text-slate-800 text-xs"
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-1.5 ml-1 block leading-normal">0을 입력하면 신청 인원 제한이 해제됩니다.</p>
                        </div>

                        <div
                            className={`lg:col-span-2 flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer select-none transition-all duration-200 ${
                                formData.show_application_count !== false
                                    ? 'bg-blue-50/40 border-blue-500/20 text-blue-600'
                                    : 'bg-slate-50 border-slate-200/60 text-slate-500 hover:bg-slate-100/50'
                            }`}
                            onClick={() => updateField('show_application_count', formData.show_application_count === false)}
                        >
                            <input
                                type="checkbox"
                                checked={formData.show_application_count !== false}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer mt-0.5 shrink-0"
                            />
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800">현재 신청 인원 공개</span>
                                <span className="text-[10px] text-slate-400 font-semibold mt-0.5">신청 화면의 정원 옆에 현재 신청 완료 인원을 표시합니다.</span>
                            </div>
                        </div>

                        {!(formData.schedule_mode === 'RECURRING' && formData.application_scope === 'SESSION') && (
                            <RecruitmentPeriodFields formData={formData} updateField={updateField} />
                        )}

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
                    </>
                )}
            </div>
        </div>
    );
};

LocationRecruitmentSettings.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
    isScheduledRegistration: PropTypes.bool.isRequired,
};

export default LocationRecruitmentSettings;
