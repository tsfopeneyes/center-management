import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { School, Settings, ChevronRight, FileText, MapPin, User, Users, ClipboardList, Plus, Calendar, Clock, MapPin as LocationIcon } from 'lucide-react';
import { SCHOOL_REGIONS, CLUB_TYPES } from '../../../constants/appConstants';
import { supabase } from '../../../supabaseClient';
import LogFormModal from './LogFormModal';
import LogDetailModal from './LogDetailModal';
import StudentDetailModal from './StudentDetailModal';

const SchoolDetailModal = ({ school, logs, staffList, onClose, isSettingsMode, setIsSettingsMode, onSaveMetadata, refreshLogs, refreshDashboardData, allUsers }) => {
    const [editData, setEditData] = useState({
        region: school.metadata?.region || '',
        club_type: school.metadata?.club_type || '',
        club_name: school.metadata?.club_name || '',
        manager_ids: school.metadata?.manager_ids || [],
        teacher_name: school.metadata?.teacher_name || '',
        meeting_time: school.metadata?.meeting_time || ''
    });

    const [isLogFormOpen, setIsLogFormOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [isInfoCollapsed, setIsInfoCollapsed] = useState(window.innerWidth < 1024);

    const handleRowClick = (log) => {
        setSelectedLog(log);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-2 md:p-8"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-6xl h-[95vh] rounded-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="p-5 md:p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                        <div className="w-10 h-10 md:w-14 md:h-14 bg-indigo-600 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-lg shrink-0">
                            <School size={20} className="md:w-7 md:h-7" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg md:text-2xl font-black text-gray-800 tracking-tighter truncate">{school.name}</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">Adolescent Member</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-[10px] md:text-xs font-bold text-gray-400 truncate">{school.students.length}명의 소속 학생</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setIsSettingsMode(!isSettingsMode)}
                            className={`flex items-center justify-center w-10 h-10 md:w-auto md:px-5 md:py-2.5 rounded-xl md:rounded-2xl font-black text-xs transition-all ${isSettingsMode ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            title="학교 설정"
                        >
                            <Settings size={16} /> <span className="hidden md:inline ml-2">{isSettingsMode ? '설정 완료' : '학교 설정'}</span>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    {/* Sidebar: School Info / Settings */}
                    <div className={`w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-gray-100 overflow-y-auto custom-scrollbar bg-gray-50/30 transition-all duration-300 ${isInfoCollapsed ? 'max-h-14 lg:max-h-full' : 'max-h-[80vh] lg:max-h-full'}`}>
                        {/* Mobile Fold Toggle */}
                        <button
                            onClick={() => setIsInfoCollapsed(!isInfoCollapsed)}
                            className="lg:hidden w-full p-4 flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 bg-white"
                        >
                            <span className="flex items-center gap-2">
                                <FileText size={14} className="text-indigo-400" />
                                학교 정보 및 요약
                            </span>
                            <motion.div animate={{ rotate: isInfoCollapsed ? 0 : 180 }}>
                                <ChevronRight size={16} className="rotate-90" />
                            </motion.div>
                        </button>

                        <div className={`p-5 md:p-6 space-y-8 ${isInfoCollapsed ? 'hidden lg:block' : 'block'}`}>
                            {isSettingsMode ? (
                                <div className="space-y-6">
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
                                                            {staff.profile_image_url ? <img src={staff.profile_image_url} className="w-full h-full object-cover" alt={staff.name} /> : <div className="w-full h-full flex items-center justify-center"><User size={12} /></div>}
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
                                <div className="space-y-8">
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
                                                                {staff.profile_image_url ? <img src={staff.profile_image_url} className="w-full h-full object-cover" alt={staff.name} /> : <User size={10} className="text-indigo-300" />}
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
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Users size={12} /> 소속 학생 명단 ({school.students.length})
                                        </h3>
                                        <div className="space-y-1.5 max-h-[240px] overflow-y-auto no-scrollbar pr-1">
                                            {school.students.map(student => (
                                                <div
                                                    key={student.id}
                                                    onClick={() => setSelectedStudent(student)}
                                                    className="flex items-center gap-3 p-2.5 bg-white border border-gray-50 rounded-xl group hover:border-indigo-100 transition-colors cursor-pointer active:scale-95"
                                                >
                                                    <div className="w-8 h-8 rounded-xl bg-gray-50 shrink-0 overflow-hidden">
                                                        {student.profile_image_url ? <img src={student.profile_image_url} className="w-full h-full object-cover" alt={student.name} /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-gray-300 bg-gray-50 uppercase">{student.name?.charAt(0)}</div>}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-black text-gray-700 truncate">{student.name}</p>
                                                        <p className="text-[9px] font-bold text-gray-400">{student.birth || '-'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Workspace: Combined Dashboard & Logs */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 bg-white flex flex-col gap-6 md:gap-8">
                        {/* Status Cards (Only show on PC or when EXpanded if you want, but for now just merging into foldable section on mobile) */}
                        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 transition-all duration-300 ${isInfoCollapsed ? 'hidden lg:grid' : 'grid'}`}>
                            <div className="p-6 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-100 flex lg:flex-col items-center lg:items-start justify-between">
                                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">소속 학생수</p>
                                <p className="text-2xl md:text-3xl font-black">{school.students.length}<span className="text-sm font-bold ml-1 opacity-60">명</span></p>
                            </div>
                            <div className="p-6 bg-white border border-gray-100 rounded-[2rem] shadow-sm flex lg:flex-col items-center lg:items-start justify-between">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">총 기록 건수</p>
                                <p className="text-2xl md:text-3xl font-black text-gray-800">{logs.length}<span className="text-sm font-bold ml-1 text-gray-400">건</span></p>
                            </div>
                            <div className="p-6 bg-white border border-gray-100 rounded-[2rem] shadow-sm flex lg:flex-col items-center lg:items-start justify-between">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">최근 활동일</p>
                                <p className="text-lg md:text-xl font-black text-gray-800 mt-0 lg:mt-2">{logs[0] ? logs[0].date : '-'}</p>
                            </div>
                        </div>

                        {/* Logs Section Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                            <h3 className="font-black text-gray-800 flex items-center gap-2 text-lg">
                                <ClipboardList className="text-indigo-600" size={24} />
                                학교 사역 일지
                            </h3>
                            <button
                                onClick={() => setIsLogFormOpen(true)}
                                className="px-6 py-4 md:py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-sm md:text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Plus size={18} /> 새로운 사역일지 입력
                            </button>
                        </div>

                        {/* Enhanced Table Header (PC Only) */}
                        <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50/80 rounded-2xl text-[11px] font-black text-gray-400 uppercase tracking-widest border border-gray-100">
                            <div className="col-span-2">날짜 및 시간</div>
                            <div className="col-span-3">참여자</div>
                            <div className="col-span-2">장소</div>
                            <div className="col-span-4">내용 요약</div>
                            <div className="col-span-1 text-center">작성자</div>
                        </div>

                        {/* Logs List - Refined Card UI */}
                        <div className="space-y-4">
                            {logs.map(log => (
                                <div
                                    key={log.id}
                                    onClick={() => handleRowClick(log)}
                                    className="lg:grid lg:grid-cols-12 flex flex-col gap-2 lg:gap-4 p-4 lg:p-6 bg-white border border-gray-100 rounded-[1.5rem] lg:rounded-[2rem] hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/30 transition-all cursor-pointer group animate-fade-in relative overflow-hidden"
                                >
                                    {/* Left Accent Bar on Hover */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    {/* Date & Time */}
                                    <div className="lg:col-span-2 flex flex-row lg:flex-col gap-3 lg:gap-1 items-center lg:items-start shrink-0">
                                        <div className="flex items-center gap-2 font-black text-indigo-600 text-sm lg:text-sm bg-indigo-50/50 lg:bg-transparent px-3 py-1 lg:px-0 lg:py-0 rounded-lg">
                                            <Calendar size={14} className="text-indigo-500 lg:w-4 lg:h-4" />
                                            {log.date}
                                        </div>
                                        {log.time_range && (
                                            <div className="flex items-center gap-2 text-[13px] lg:text-xs text-gray-400 font-extrabold">
                                                <Clock size={14} />
                                                {log.time_range}
                                            </div>
                                        )}
                                    </div>

                                    {/* Participants */}
                                    <div className="lg:col-span-3 flex items-center gap-1.5 flex-wrap">
                                        {log.participant_ids?.length > 0 ? (
                                            log.participant_ids.slice(0, 6).map(pid => {
                                                const student = school.students.find(s => s.id === pid) || allUsers.find(u => u.id === pid);
                                                return student ? (
                                                    <div key={pid} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[10px] lg:text-[11px] font-black text-gray-500 group-hover:bg-indigo-50 group-hover:border-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                        {student.name}
                                                    </div>
                                                ) : null;
                                            })
                                        ) : (
                                            <span className="text-[10px] lg:text-[11px] text-gray-300 font-bold px-1">참여자 미지정</span>
                                        )}
                                        {log.participant_ids?.length > 6 && (
                                            <span className="text-[10px] lg:text-[11px] text-gray-400 font-black">+{log.participant_ids.length - 6}</span>
                                        )}
                                    </div>

                                    {/* Location - Hidden on Mobile List */}
                                    <div className="lg:col-span-2 hidden lg:flex items-center gap-2.5">
                                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 text-gray-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-colors">
                                            <LocationIcon size={16} />
                                        </div>
                                        <span className="text-[13px] font-black text-gray-600 group-hover:text-gray-900 transition-colors truncate">{log.location || '장소 기록 없음'}</span>
                                    </div>

                                    {/* Content Summary - Compact on Mobile */}
                                    <div className={`lg:col-span-4 lg:flex flex-col justify-center min-w-0 py-1 ${window.innerWidth < 1024 ? 'hidden' : 'flex'}`}>
                                        <p className="text-[14px] lg:text-sm font-bold text-gray-800 line-clamp-2 md:line-clamp-2 leading-relaxed group-hover:text-indigo-700 transition-colors">
                                            {log.content?.replace(/[\*\#\-]/g, ' ').substring(0, 100) || '기록된 내용이 없습니다.'}
                                        </p>
                                    </div>

                                    {/* Author (Mobile: Simple Arrow) */}
                                    <div className="lg:col-span-1 flex lg:flex-col items-center justify-end lg:justify-center gap-2 lg:border-t-0 lg:pt-0 lg:mt-0 border-gray-50 absolute right-4 top-1/2 -translate-y-1/2 lg:static lg:translate-y-0">
                                        <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            ))}

                            {logs.length === 0 && (
                                <div className="p-20 text-center flex flex-col items-center justify-center gap-4 bg-gray-50/30 rounded-[3rem] border-2 border-dashed border-gray-100">
                                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-gray-200 shadow-sm">
                                        <FileText size={32} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-gray-400 font-black">기록된 사역 일지가 없습니다</p>
                                        <p className="text-xs text-gray-300 font-bold">새로운 사역일지를 작성하여 데이터를 기록해 보세요</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Log Entry Form Modal */}
                <AnimatePresence>
                    {isLogFormOpen && (
                        <LogFormModal
                            school={school}
                            onClose={() => setIsLogFormOpen(false)}
                            onSave={async (formData) => {
                                try {
                                    const { error } = await supabase.from('school_logs').insert([{
                                        school_id: school.metadata?.id,
                                        author_id: JSON.parse(localStorage.getItem('user'))?.id,
                                        ...formData
                                    }]);
                                    if (error) throw error;
                                    await refreshLogs();
                                    setIsLogFormOpen(false);
                                } catch (err) {
                                    alert('사역일지 저장 실패: ' + err.message);
                                }
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* Log Detail Modal - Feed Version */}
                <AnimatePresence>
                    {selectedLog && (
                        <LogDetailModal
                            logs={logs}
                            initialLogId={selectedLog.id}
                            school={school}
                            onClose={() => setSelectedLog(null)}
                            onRefresh={refreshLogs}
                            onDelete={async (id) => {
                                if (confirm('정말 삭제하시겠습니까?')) {
                                    try {
                                        await supabase.from('school_logs').delete().eq('id', id);
                                        await refreshLogs();
                                        setSelectedLog(null);
                                    } catch (err) { alert('삭제 실패'); }
                                }
                            }}
                            allUsers={allUsers}
                        />
                    )}
                </AnimatePresence>

                {/* Student Detail Modal */}
                <AnimatePresence>
                    {selectedStudent && (
                        <StudentDetailModal
                            student={selectedStudent}
                            onClose={() => setSelectedStudent(null)}
                            onSave={async (updates) => {
                                try {
                                    const { error } = await supabase.from('users').update(updates).eq('id', selectedStudent.id);
                                    if (error) throw error;
                                    await refreshLogs();
                                    if (refreshDashboardData) await refreshDashboardData();
                                    setSelectedStudent(null);
                                } catch (err) {
                                    alert('학생 정보 저장 실패: ' + err.message);
                                }
                            }}
                        />
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

export default SchoolDetailModal;
