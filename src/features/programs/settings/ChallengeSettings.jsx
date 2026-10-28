import React from 'react';
import PropTypes from 'prop-types';
import { MapPin, Target, Trash, Bookmark, Camera, FileText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { HAIFN_DETAILS } from './programLocationOptions';
import { getChallengeProgress } from '../../../utils/challengeProgress';

const ChallengeSettings = ({ formData, updateField }) => {
    const progress = getChallengeProgress({ ...formData, guest_properties: null });
    return (
        <>
            {formData.is_challenge && (
                <div className="space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <label className="block text-sm font-bold text-slate-800">챌린지 성공 기준
                        <select value={formData.challenge_reward_criterion || 'ALL'} onChange={event => updateField('challenge_reward_criterion', event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                            <option value="ALL">전체 목표 달성</option>
                            <option value="COUNT">횟수로 설정</option>
                            <option value="PERCENT">달성률로 설정</option>
                            {formData.challenge_reward_criterion === 'FIRST_MISSION' && <option value="FIRST_MISSION">1회 달성하면 성공 (기존 설정)</option>}
                        </select>
                    </label>
                    {formData.challenge_reward_criterion === 'COUNT' && <label className="mt-3 block text-xs font-bold text-slate-600">성공에 필요한 횟수<input type="number" min="1" max={progress.total || undefined} step="1" value={formData.challenge_reward_count ?? 1} onChange={event => updateField('challenge_reward_count', event.target.value === '' ? '' : Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold"/></label>}
                    {formData.challenge_reward_criterion === 'PERCENT' && <label className="mt-3 block text-xs font-bold text-slate-600">성공 기준 (%)<input type="number" min="1" max="100" step="1" value={formData.challenge_reward_percent ?? 100} onChange={event => updateField('challenge_reward_percent', Math.min(100, Math.max(1, Math.trunc(Number(event.target.value) || 1))))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold"/></label>}
                    <p aria-live="polite" className="mt-3 text-sm font-semibold text-slate-800">{progress.description}</p>
                    {progress.total > 0 && progress.threshold > progress.total && <p role="alert" className="mt-2 text-xs text-red-600">성공 횟수가 전체 목표보다 큽니다. 횟수 또는 미션 목표를 조정해주세요.</p>}
                    <p className="mt-2 text-xs leading-5 text-slate-500">기준을 달성하면 바로 성공 메시지를 보여줍니다. 성공 후에도 추가 참여할 수 있으며, 설정된 하이픈은 프로그램 종료 처리 시 한 번 지급합니다.</p>
                </div>
                {(formData.challenge_format !== 'ONLINE' || formData.community_enabled) && <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                        <Target size={18} className="text-blue-600" />
                        <span className="text-sm font-bold text-slate-800">{formData.challenge_format === 'ONLINE' ? '온라인 미션 설정' : '오프라인 미션 설정'}</span>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {(formData.challenge_missions || []).map((mission, index) => {
                                const knownLocations = ['이높플레이스', ...HAIFN_DETAILS.map(d => `하이픈 ${d}`)];
                                const isKnownLocation = knownLocations.includes(mission.location);
                                const showCustomLoc = mission.location_type === 'custom' || Boolean(mission.location && !isKnownLocation);
                                const locationSelectValue = showCustomLoc
                                    ? 'custom'
                                    : (isKnownLocation ? mission.location : '');
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

                                            {formData.challenge_format === 'ONLINE' && (
                                                <div className="grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                                                    <label className="text-xs font-bold text-slate-600">수행 방식
                                                        <select
                                                            value={mission.schedule_type || 'FLEXIBLE'}
                                                            onChange={e => {
                                                                const scheduleType = e.target.value;
                                                                const updated = [...(formData.challenge_missions || [])];
                                                                updated[index] = { ...updated[index], schedule_type: scheduleType, fixed_date: '', target_count: scheduleType === 'FLEXIBLE' ? Math.max(1, Number(updated[index].target_count) || 1) : 1 };
                                                                updateField('challenge_missions', updated);
                                                            }}
                                                            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none"
                                                        >
                                                            <option value="DAILY">챌린지 기간 동안 매일</option>
                                                            <option value="FIXED_DATE">지정한 날짜에 한 번</option>
                                                            <option value="FLEXIBLE">기간 내 정한 횟수</option>
                                                        </select>
                                                    </label>
                                                    {mission.schedule_type === 'FIXED_DATE' && <label className="text-xs font-bold text-slate-600">수행 날짜
                                                        <input type="date" min={formData.program_start_date || undefined} max={formData.program_end_date || undefined} value={mission.fixed_date || ''} onChange={e => { const updated = [...(formData.challenge_missions || [])]; updated[index] = { ...updated[index], fixed_date: e.target.value }; updateField('challenge_missions', updated); }} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none" />
                                                    </label>}
                                                    {(mission.schedule_type || 'FLEXIBLE') === 'FLEXIBLE' && <label className="text-xs font-bold text-slate-600">목표 횟수
                                                        <input type="number" min="1" max="365" value={mission.target_count || 1} onChange={e => { const updated = [...(formData.challenge_missions || [])]; updated[index] = { ...updated[index], target_count: Math.max(1, Number(e.target.value) || 1) }; updateField('challenge_missions', updated); }} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none" />
                                                    </label>}
                                                </div>
                                            )}

                                            {formData.challenge_format !== 'ONLINE' && <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">수행 장소</label>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <div className="flex-1 h-10 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3">
                                                        <MapPin className="text-slate-400 shrink-0 mr-2" size={14} />
                                                        <select
                                                            value={locationSelectValue}
                                                            onChange={(e) => {
                                                                const location = e.target.value;
                                                                const updated = [...(formData.challenge_missions || [])];
                                                                if (location === 'custom') {
                                                                    updated[index] = { ...updated[index], location_type: 'custom', location: '' };
                                                                } else {
                                                                    updated[index] = {
                                                                        ...updated[index],
                                                                        location_type: location,
                                                                        location
                                                                    };
                                                                }
                                                                updateField('challenge_missions', updated);
                                                            }}
                                                            className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer appearance-none"
                                                        >
                                                            <option value="">장소 선택 안함</option>
                                                            {HAIFN_DETAILS.map(detail => (
                                                                <option key={detail} value={`하이픈 ${detail}`}>
                                                                    하이픈 {detail}
                                                                </option>
                                                            ))}
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
                                            </div>}

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

                                            {formData.challenge_format !== 'ONLINE' && <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">인증 방식</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {[
                                                        { value: 'PHOTO', label: '사진 업로드', icon: Camera },
                                                        { value: 'TEXT', label: '텍스트 입력', icon: FileText }
                                                    ].map(({ value, label, icon: Icon }) => {
                                                        const selected = String(mission.verification_type || 'PHOTO').toUpperCase() === value;
                                                        return (
                                                            <button
                                                                key={value}
                                                                type="button"
                                                                onClick={() => {
                                                                    const updated = [...(formData.challenge_missions || [])];
                                                                    updated[index] = { ...updated[index], verification_type: value };
                                                                    updateField('challenge_missions', updated);
                                                                }}
                                                                className={`h-10 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                                                    selected
                                                                        ? 'bg-blue-50 border-blue-500 text-blue-600'
                                                                        : 'bg-slate-50 border-slate-200/60 text-slate-500 hover:border-slate-300'
                                                                }`}
                                                            >
                                                                <Icon size={14} />
                                                                {label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                const newMission = {
                                    id: uuidv4(),
                                    title: '',
                                    location: '',
                                    location_type: '',
                                    description: '',
                                    verification_type: 'PHOTO',
                                    schedule_type: 'FLEXIBLE',
                                    fixed_date: '',
                                    target_count: 1
                                };
                                updateField('challenge_missions', [...(formData.challenge_missions || []), newMission]);
                            }}
                            className="w-full py-3 bg-slate-50 border border-dashed border-slate-200 hover:border-blue-500 rounded-xl font-bold text-slate-500 hover:text-blue-600 transition-all text-xs flex items-center justify-center gap-1.5 shadow-sm"
                        >
                            + 미션 추가
                        </button>
                    </div>

                    <div className="pt-4 border-t border-slate-100 space-y-2">
                        <label className="text-xs font-bold text-slate-500 mb-1 block">성공 기준 달성 시 축하/안내 메시지</label>
                        <div className="relative bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all p-3">
                            <textarea
                                value={formData.challenge_success_message || ''}
                                onChange={e => updateField('challenge_success_message', e.target.value)}
                                placeholder="축하합니다! 챌린지 성공 기준을 달성했어요!"
                                className="w-full h-20 bg-transparent outline-none font-bold text-slate-800 text-xs resize-none"
                            />
                        </div>
                    </div>
                </div>}</div>
            )}
        </>
    );
};

ChallengeSettings.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
};

export default ChallengeSettings;
