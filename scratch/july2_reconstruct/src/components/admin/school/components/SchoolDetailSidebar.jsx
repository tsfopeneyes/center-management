import React from 'react';
import { Settings, FileText, ChevronRight, MapPin, User, Users, Plus, Star, Save } from 'lucide-react';
import { SCHOOL_REGIONS, CLUB_TYPES } from '../../../../constants/appConstants';
import { calculateAge } from '../../../../utils/dateUtils';
import { motion } from 'framer-motion';

const SchoolDetailSidebar = ({
    school, 
    staffList, 
    isSettingsMode, 
    setIsSettingsMode, 
    onSaveMetadata, 
    onToggleLeader,
    hookData
}) => {
    const {
        isInfoCollapsed, setIsInfoCollapsed,
        editData, setEditData,
        setIsAddTempStudentModalOpen,
        setSelectedStudent
    } = hookData;

    return (
        <div className={`w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-gray-100 overflow-y-auto custom-scrollbar bg-gray-50/30 transition-all duration-300 ${isInfoCollapsed ? 'max-h-14 lg:max-h-full' : 'max-h-[80vh] lg:max-h-full'}`}>
            {/* Sidebar Header & Mobile Fold Toggle */}
            <div className="w-full border-b border-gray-100 bg-white flex items-center">
                <button
                    onClick={() => setIsInfoCollapsed(!isInfoCollapsed)}
                    className="flex-1 p-4 flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest"
                >
                    <span className="flex items-center gap-2">
                        <FileText size={14} className="text-indigo-400" />
                        학교 정보 및 요약
                    </span>
                    <motion.div className="lg:hidden" animate={{ rotate: isInfoCollapsed ? 0 : 180 }}>
                        <ChevronRight size={16} className="rotate-90" />
                    </motion.div>
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsSettingsMode(!isSettingsMode);
                        if (window.innerWidth < 1024) setIsInfoCollapsed(false);
                    }}
                    className={`p-4 border-l border-gray-100 transition-all ${isSettingsMode ? 'text-indigo-600 bg-indigo-50 shadow-inner' : 'text-gray-400 hover:text-indigo-500 hover:bg-gray-50'}`}
                    title="학교 설정"
                >
                    <Settings size={18} className={`${isSettingsMode ? 'animate-spin-slow' : ''}`} />
                </button>
            </div>

            <div className={`p-5 md:p-6 space-y-8 ${isInfoCollapsed ? 'hidden lg:block' : 'block'}`}>
                {isSettingsMode ? (
                    <div className="space-y-6 animate-fade-in-up">
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                            <Settings size={14} className="text-indigo-500" />
                            학교 기본 설정
                        </h3>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">지역 선택</label>
                                <div className="flex gap-2">
                                    {SCHOOL_REGIONS.map(r => (
                                        <button
                                            key={r}
                                            onClick={() => setEditData({ ...editData, region: r })}
                                            className={`flex-1 py-3 rounded-2xl font-black text-xs transition-all ${editData.region === r ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">동아리 구분</label>
                                <select
                                    value={editData.club_type}
                                    onChange={(e) => setEditData({ ...editData, club_type: e.target.value })}
                                    className="w-full p-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                                >
                                    <option value="">구분 선택...</option>
                                    {Object.values(CLUB_TYPES).map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">동아리명</label>
                                <input
                                    type="text"
                                    value={editData.club_name}
                                    onChange={(e) => setEditData({ ...editData, club_name: e.target.value })}
                                    placeholder="동아리명 입력"
                                    className="w-full p-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">선생님 성함</label>
                                <input
                                    type="text"
                                    value={editData.teacher_name}
                                    onChange={(e) => setEditData({ ...editData, teacher_name: e.target.value })}
                                    placeholder="담당 선생님 성함 입력"
                                    className="w-full p-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">모임 시간</label>
                                <input
                                    type="text"
                                    value={editData.meeting_time}
                                    onChange={(e) => setEditData({ ...editData, meeting_time: e.target.value })}
                                    placeholder="예: 매주 목요일 오후 5시"
                                    className="w-full p-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">담당 매니저 (STAFF)</label>
                                <div className="grid grid-cols-1 gap-1 max-h-[160px] overflow-y-auto no-scrollbar p-1">
                                    {staffList.map(staff => (
                                        <button
                                            key={staff.id}
                                            onClick={() => {
                                                const current = editData.manager_ids || [];
                                                setEditData({ ...editData, manager_ids: current.includes(staff.id) ? current.filter(id => id !== staff.id) : [...current, staff.id] });
                                            }}
                                            className={`flex items-center gap-2 p-2 rounded-xl text-[11px] font-bold transition-all ${editData.manager_ids?.includes(staff.id) ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-white border border-gray-50 text-gray-400 hover:bg-gray-50'}`}
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                                                {staff.profile_image_url ? <img src={staff.profile_image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User size={12} /></div>}
                                            </div>
                                            <span className="truncate">{staff.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => onSaveMetadata(editData)}
                            className="w-full py-4 bg-indigo-600 text-white rounded-[1.5rem] font-bold text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <Save size={18} /> 수정 내용 저장
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in">
                        <section>
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <MapPin size={12} /> 기본 프로필
                            </h3>
                            <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-100/50 shadow-sm">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-bold">지역</span>
                                    <span className="font-black text-gray-700">{school.metadata?.region || '미지정'}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-bold">동아리 구분</span>
                                    <span className="font-black text-gray-700">{school.metadata?.club_type || '미지정'}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-bold">동아리명</span>
                                    <span className="font-black text-indigo-600">{school.metadata?.club_name || '미지정'}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-bold">선생님 성함</span>
                                    <span className="font-black text-gray-700">{school.metadata?.teacher_name || '미지정'}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-bold">모임 시간</span>
                                    <span className="font-black text-gray-700">{school.metadata?.meeting_time || '미지정'}</span>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <User size={12} /> 관리 매니저
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                                {school.metadata?.manager_ids?.length > 0 ? (
                                    school.metadata.manager_ids.map(mid => {
                                        const staff = staffList.find(s => s.id === mid);
                                        return staff ? (
                                            <div key={mid} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-xl shadow-xs">
                                                <div className="w-5 h-5 rounded-lg bg-indigo-50 flex items-center justify-center overflow-hidden">
                                                    {staff.profile_image_url ? <img src={staff.profile_image_url} className="w-full h-full object-cover" /> : <User size={10} className="text-indigo-300" />}
                                                </div>
                                                <span className="text-[11px] font-extrabold text-gray-700">{staff.name}</span>
                                            </div>
                                        ) : null;
                                    })
                                ) : (
                                    <p className="text-[11px] font-bold text-gray-300 italic px-2">지정된 매니저 없음</p>
                                )}
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Users size={12} /> 소속 학생 명단 ({school.students.length})
                                </h3>
                                <button
                                    onClick={() => setIsAddTempStudentModalOpen(true)}
                                    className="bg-amber-50 text-amber-600 px-2 py-1.5 rounded-lg text-[10px] font-black hover:bg-amber-100 transition-colors border border-amber-200 flex items-center gap-1 shadow-sm"
                                >
                                    <Plus size={12} /> 임시 학생
                                </button>
                            </div>
                            <div className="space-y-1.5 max-h-[240px] overflow-y-auto no-scrollbar pr-1">
                                {school.students.map(student => (
                                    <div
                                        key={student.id}
                                        onClick={() => setSelectedStudent(student)}
                                        className={`flex items-center gap-3 p-2.5 bg-white border ${student.preferences?.is_temporary ? 'border-amber-200 bg-amber-50/30' : 'border-gray-50'} rounded-xl group hover:border-indigo-100 transition-colors cursor-pointer active:scale-95`}
                                    >
                                        <div className={`w-8 h-8 rounded-xl ${student.preferences?.is_temporary ? 'bg-amber-100/50 text-amber-500' : 'bg-gray-50 text-gray-300'} shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-black uppercase`}>
                                            {student.profile_image_url ? <img src={student.profile_image_url} className="w-full h-full object-cover" /> : student.name?.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-black text-gray-700 truncate flex items-center gap-1">
                                                {student.name}
                                                {student.preferences?.is_temporary && <span className="text-[8px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md ml-1 font-bold">미가입</span>}
                                                {student.birth && <span className="text-[10px] text-gray-400 font-extrabold">[{calculateAge(student.birth)}]</span>}
                                            </p>
                                            <p className="text-[9px] font-bold text-gray-400">{student.birth || '-'}</p>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleLeader(student);
                                            }}
                                            className={`p-1.5 rounded-lg transition-colors ${student.is_leader ? 'text-yellow-400 bg-yellow-50' : 'text-gray-200 hover:text-gray-400 hover:bg-gray-50'}`}
                                            title={student.is_leader ? "리더 해제" : "리더 지정"}
                                        >
                                            <Star size={14} fill={student.is_leader ? "currentColor" : "none"} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SchoolDetailSidebar;
