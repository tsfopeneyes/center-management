import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../../../supabaseClient';
import { Search, Plus, Trash2, Edit2, Download, Copy, ExternalLink, Calendar, MapPin, CheckCircle, RefreshCw, Eye, MessageCircle, FileText, X, School, Flame, LayoutGrid, LayoutList, CheckCircle2, User, Users, ChevronRight, ChevronLeft, Grid, List, Star, Heart, Columns, Settings, ClipboardList, Save, Clock, Cookie } from 'lucide-react';
import { SCHOOL_REGIONS, CLUB_TYPES } from '../../../../constants/appConstants';
import { calculateAge } from '../../../../utils/dateUtils';
import { motion, AnimatePresence } from 'framer-motion';
import TemplateManager from '../../messages/TemplateManager';
import { userApi } from '../../../../api/userApi';
import LogSelectorModal from '../LogSelectorModal';
import { normalizeSchoolName } from '../../../../utils/schoolUtils';

const SchoolDetailModal = ({ school, logs, staffList, onClose, isSettingsMode, setIsSettingsMode, onSaveMetadata, onToggleLeader, refreshLogs, refreshDashboardData, allUsers }) => {
    // Safety check for school prop
    if (!school) return null;

    const [editData, setEditData] = useState({
        region: school.metadata?.region || '',
        club_type: school.metadata?.club_type || '',
        club_name: school.metadata?.club_name || '',
        manager_ids: school.metadata?.manager_ids || [],
        teacher_name: school.metadata?.teacher_name || '',
        meeting_time: school.metadata?.meeting_time || '',
        snack_history: Array.from({ length: 10 }, (_, i) => (school.metadata?.snack_history && school.metadata.snack_history[i]) || { date: '', type: '' })
    });

    // Reset editData when school changes
    useEffect(() => {
        console.log('SchoolDetailModal useEffect triggered:', school);
        setEditData({
            region: school.metadata?.region || '',
            club_type: school.metadata?.club_type || '',
            club_name: school.metadata?.club_name || '',
            manager_ids: school.metadata?.manager_ids || [],
            teacher_name: school.metadata?.teacher_name || '',
            meeting_time: school.metadata?.meeting_time || '',
            snack_history: Array.from({ length: 10 }, (_, i) => (school.metadata?.snack_history && school.metadata.snack_history[i]) || { date: '', type: '' })
        });
    }, [school]);

    const [isLogFormOpen, setIsLogFormOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [isInfoCollapsed, setIsInfoCollapsed] = useState(window.innerWidth < 1024);

    const [isAddTempStudentModalOpen, setIsAddTempStudentModalOpen] = useState(false);
    const [newTempStudentName, setNewTempStudentName] = useState('');
    const [newTempStudentPhone, setNewTempStudentPhone] = useState('');
    const [addingTempStudent, setAddingTempStudent] = useState(false);

    const handleAddTempStudent = async () => {
        if (!newTempStudentName.trim()) return;
        setAddingTempStudent(true);
        try {
            let phoneVal = '미가입';
            let phoneBack4Val = '미가입';
            if (newTempStudentPhone.trim()) {
                phoneVal = newTempStudentPhone.trim();
                phoneBack4Val = phoneVal.length >= 4 ? phoneVal.slice(-4) : phoneVal;
            }

            const { error } = await supabase.from('users').insert([{
                name: newTempStudentName.trim(),
                school: school.name,
                user_group: '청소년',
                phone: phoneVal,
                phone_back4: phoneBack4Val,
                status: 'approved',
                preferences: { is_temporary: true }
            }]);
            if (error) throw error;
            setIsAddTempStudentModalOpen(false);
            setNewTempStudentName('');
            setNewTempStudentPhone('');
            await refreshLogs();
            if (refreshDashboardData) await refreshDashboardData();
        } catch (err) {
            alert('임시 학생 추가 실패: ' + err.message);
        } finally {
            setAddingTempStudent(false);
        }
    };

    const [activeTab, setActiveTab] = useState('logs');
    const [callingForestData, setCallingForestData] = useState([]);
    const [expandedForestStudent, setExpandedForestStudent] = useState(null);
    const [selectorState, setSelectorState] = useState({ isOpen: false, student: null, week: null });

    const fetchCallingForestData = async () => {
        if (!school?.students?.length) return;
        const studentIds = school.students.map(s => s.id);
        const { data, error } = await supabase
            .from('calling_forest_progress')
            .select('*')
            .in('student_id', studentIds);
        if (!error && data) {
            setCallingForestData(data);
        }
    };

    useEffect(() => {
        if (activeTab === 'calling_forest') {
            fetchCallingForestData();
        }
    }, [activeTab, school]);

    const handleLinkLog = async (log) => {
        try {
            const { student, week } = selectorState;
            const existingProgress = callingForestData.find(d => d.student_id === student.id && d.week_number === week);

            if (existingProgress) {
                await supabase.from('calling_forest_progress').update({ log_id: log.id }).eq('id', existingProgress.id);
            } else {
                await supabase.from('calling_forest_progress').insert([{
                    student_id: student.id,
                    week_number: week,
                    log_id: log.id
                }]);
            }
            fetchCallingForestData();
            setSelectorState({ isOpen: false, student: null, week: null });
        } catch (error) {
            alert('로그 연결 중 오류가 발생했습니다.');
        }
    };

    const handleToggleManualProgress = async (student, week) => {
        try {
            const existingProgress = callingForestData.find(d => d.student_id === student.id && d.week_number === week);

            if (existingProgress) {
                // If exists, this function shouldn't be called for 'Check', but maybe for 'Uncheck'?
                // Actually handleUnlinkLog handles deletion.
                return;
            } else {
                await supabase.from('calling_forest_progress').insert([{
                    student_id: student.id,
                    week_number: week,
                    log_id: null
                }]);
            }
            fetchCallingForestData();
        } catch (error) {
            alert('진행 상태 변경 중 오류가 발생했습니다.');
        }
    };

    const handleUnlinkLog = async (progressId) => {
        if (!confirm('연결을 해제하시겠습니까?')) return;
        try {
            await supabase.from('calling_forest_progress').delete().eq('id', progressId);
            fetchCallingForestData();
        } catch (error) {
            alert('연결 해제 중 오류가 발생했습니다.');
        }
    };

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
                        {/* Tab Switcher (PC & Mobile) */}
                        <div className="flex bg-gray-100/80 p-1 rounded-xl md:rounded-2xl mr-1 md:mr-4">
                            <button
                                onClick={() => setActiveTab('logs')}
                                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all ${activeTab === 'logs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                학교 현황
                            </button>
                            <button
                                onClick={() => setActiveTab('calling_forest')}
                                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all ${activeTab === 'calling_forest' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                콜링포레스트
                            </button>
                            <button
                                onClick={() => setActiveTab('snacks')}
                                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all ${activeTab === 'snacks' ? 'bg-white text-amber-500 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                간식
                            </button>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors hidden md:block">
                            <X size={24} />
                        </button>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 transition-colors md:hidden">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    {/* Sidebar: School Info / Settings */}
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

                    {/* Main Workspace: Combined Dashboard & Logs */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 bg-white flex flex-col gap-6 md:gap-8">
                        {activeTab === 'logs' && (
                            <>
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
                                <div className="hidden lg:flex items-center gap-4 px-6 py-4 bg-gray-50/80 rounded-2xl text-[11px] font-black text-gray-400 uppercase tracking-widest border border-gray-100">
                                    <div className="w-[180px] shrink-0 text-center">날짜 및 시간</div>
                                    <div className="flex-1 min-w-0">참여자</div>
                                    <div className="w-[120px] shrink-0 text-center">장소</div>
                                    <div className="w-[80px] shrink-0 text-center">작성자</div>
                                </div>

                                {/* Logs List - Refined Card UI */}
                                <div className="space-y-4">
                                    {logs.map(log => (
                                        <div
                                            key={log.id}
                                            onClick={() => handleRowClick(log)}
                                            className="flex items-center gap-4 px-6 py-4 bg-white border border-gray-100 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group animate-fade-in relative overflow-hidden"
                                        >
                                            {/* Left Accent Bar on Hover */}
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                            {/* Date & Time (Fixed Width, Single Line) */}
                                            <div className="flex items-center justify-center gap-2 shrink-0 w-[180px]">
                                                <span className="text-[12px] font-black text-indigo-600 whitespace-nowrap">{log.date}</span>
                                                <div className="w-[1px] h-3 bg-gray-200"></div>
                                                <span className="text-[11px] text-gray-400 font-bold whitespace-nowrap overflow-hidden text-ellipsis">{log.time_range}</span>
                                            </div>

                                            {/* Participants & Facilitators (Flexible Width) */}
                                            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                                                {/* Facilitators */}
                                                {log.facilitator_ids?.map(fid => {
                                                    const staff = staffList.find(s => s.id === fid);
                                                    return staff ? (
                                                        <span key={fid} className="shrink-0 px-2 py-0.5 bg-indigo-600 rounded text-[10px] font-bold text-white whitespace-nowrap">
                                                            {staff.name}
                                                        </span>
                                                    ) : null;
                                                })}

                                                {/* Students */}
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                    {log.participant_ids?.length > 0 ? (
                                                        log.participant_ids.map(pid => {
                                                            const student = school.students.find(s => s.id === pid) || (allUsers || []).find(u => u.id === pid);
                                                            return student ? (
                                                                <span key={pid} className="shrink-0 text-[11px] text-gray-500 font-bold whitespace-nowrap hover:text-indigo-600">
                                                                    {student.name}
                                                                </span>
                                                            ) : null;
                                                        })
                                                    ) : (
                                                        (!log.facilitator_ids || log.facilitator_ids.length === 0) && (
                                                            <span className="text-[10px] text-gray-300 font-bold">참여자 없음</span>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            {/* Location (Text Only, Truncate) */}
                                            <div className="w-[120px] shrink-0 text-center hidden md:block">
                                                <div className="text-[11px] text-gray-400 font-bold truncate px-2">
                                                    {log.location || '-'}
                                                </div>
                                            </div>

                                            {/* Author */}
                                            <div className="w-[80px] shrink-0 flex justify-center items-center">
                                                <span className="text-[11px] font-bold text-gray-500">
                                                    {log.author_id ? ((allUsers || []).find(u => u.id === log.author_id)?.name || '알수없음') : '-'}
                                                </span>
                                            </div>

                                            {/* Arrow Icon */}
                                            <ChevronRight size={14} className="text-gray-300 shrink-0 group-hover:text-indigo-500 transition-colors" />
                                        </div>))}

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
                            </>
                        )}

                        {activeTab === 'calling_forest' && (
                            <div className="animate-fade-in space-y-4">
                                <div className="bg-green-50/50 rounded-2xl p-4 border border-green-100 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                                    </div>
                                    <p className="text-sm font-bold text-green-800">학생 이름 클릭시 1주차~6주차 진행 상황을 기록하고 사역일지와 연결할 수 있습니다.</p>
                                </div>
                                <div className="space-y-3">
                                    {school.students.filter(s => s.is_leader).map(student => (
                                        <div key={student.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                            <button
                                                onClick={() => setExpandedForestStudent(expandedForestStudent === student.id ? null : student.id)}
                                                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                                                        {student.profile_image_url ? <img src={student.profile_image_url} className="w-full h-full object-cover" /> : <User size={16} className="text-gray-300" />}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-black text-gray-800 flex items-center gap-1.5">{student.name}
                                                            <span className="text-[10px] font-bold text-gray-400">[{student.birth || '생일 미상'}]</span>
                                                        </p>
                                                        <div className="flex gap-1 mt-1">
                                                            {[1, 2, 3, 4, 5, 6].map(w => {
                                                                const isCompleted = callingForestData.some(d => d.student_id === student.id && d.week_number === w);
                                                                return (
                                                                    <div key={w} className={`w-3 h-3 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} title={`${w}주차`} />
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight size={20} className={`text-gray-400 transition-transform ${expandedForestStudent === student.id ? 'rotate-90' : ''}`} />
                                            </button>

                                            <AnimatePresence>
                                                {expandedForestStudent === student.id && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="p-4 bg-gray-50/50 border-t border-gray-100 space-y-2">
                                                            {[1, 2, 3, 4, 5, 6].map(week => {
                                                                const progress = callingForestData.find(d => d.student_id === student.id && d.week_number === week);
                                                                return (
                                                                    <div key={week} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-700 font-black text-xs">{week}주</span>
                                                                            {progress ? (
                                                                                progress.log_id ? (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const theLog = logs.find(l => l.id === progress.log_id);
                                                                                            if (theLog) setSelectedLog(theLog);
                                                                                        }}
                                                                                        className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                                                                                    >
                                                                                        <FileText size={14} />
                                                                                        연결된 일지 보기
                                                                                    </button>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-bold">
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                                        수동 체크됨
                                                                                    </div>
                                                                                )
                                                                            ) : (
                                                                                <span className="text-sm font-bold text-gray-400">진행 기록 없음</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {progress ? (
                                                                                <button
                                                                                    onClick={() => handleUnlinkLog(progress.id)}
                                                                                    className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors text-xs font-bold"
                                                                                >
                                                                                    {progress.log_id ? '연결 해제' : '체크 취소'}
                                                                                </button>
                                                                            ) : (
                                                                                <>
                                                                                    <button
                                                                                        onClick={() => handleToggleManualProgress(student, week)}
                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 border border-green-100 text-green-600 text-xs font-black rounded-lg transition-all"
                                                                                    >
                                                                                        체크
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => setSelectorState({ isOpen: true, student, week })}
                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-white border border-gray-200 hover:border-indigo-300 text-gray-600 hover:text-indigo-600 text-xs font-black rounded-lg transition-all"
                                                                                    >
                                                                                        <Plus size={14} /> 일지 연결
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                    {school.students.filter(s => s.is_leader).length === 0 && (
                                        <div className="p-10 text-center text-gray-400 font-bold bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                            지정된 학생 리더가 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'snacks' && (
                            <div className="animate-fade-in space-y-8">
                                <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                                        <Cookie size={20} />
                                    </div>
                                    <p className="text-sm font-bold text-amber-800">이 학교에 지원된 간식 내역을 기록합니다. (최대 10회)</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(editData.snack_history?.length === 10 ? editData.snack_history : Array.from({ length: 10 }, (_, i) => editData.snack_history?.[i] || { date: '', type: '' })).map((snack, index) => (
                                        <div key={index} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                                            <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                                                <span className="text-[11px] font-black text-amber-500 uppercase tracking-widest">{index + 1}회차 지원</span>
                                                {snack.date && <CheckCircle size={14} className="text-amber-400" />}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">날짜</label>
                                                    <input
                                                        type="date"
                                                        value={snack.date}
                                                        onChange={(e) => {
                                                            const newHistory = [...editData.snack_history];
                                                            newHistory[index] = { ...newHistory[index], date: e.target.value };
                                                            setEditData({ ...editData, snack_history: newHistory });
                                                        }}
                                                        className="w-full p-2 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-bold outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">간식 종류</label>
                                                    <input
                                                        type="text"
                                                        value={snack.type}
                                                        onChange={(e) => {
                                                            const newHistory = [...editData.snack_history];
                                                            newHistory[index] = { ...newHistory[index], type: e.target.value };
                                                            setEditData({ ...editData, snack_history: newHistory });
                                                        }}
                                                        placeholder="예: 햄버거 20개"
                                                        className="w-full p-2 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-bold outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => onSaveMetadata(editData)}
                                    className="w-full py-4 bg-amber-500 text-white rounded-[1.5rem] font-black text-sm shadow-xl shadow-amber-100 hover:bg-amber-600 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <Save size={18} /> 간식 지원 정보 일괄 저장
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Log Entry Form Modal */}
                <AnimatePresence>
                    {isLogFormOpen && (
                        <LogFormModal
                            school={school}

                            staffList={staffList}
                            onClose={() => setIsLogFormOpen(false)}
                            onSave={async (formData) => {
                                try {
                                    let schoolId = school.metadata?.id;
                                    if (!schoolId) {
                                        // Auto-create school entry
                                        const { data: newSchool, error: schoolErr } = await supabase
                                            .from('schools')
                                            .insert([{ name: school.name }])
                                            .select('id')
                                            .single();
                                        if (schoolErr) throw schoolErr;
                                        schoolId = newSchool.id;
                                    }

                                    const { error } = await supabase.from('school_logs').insert([{
                                        school_id: schoolId,
                                        author_id: (JSON.parse(localStorage.getItem('admin_user')) || JSON.parse(localStorage.getItem('user')))?.id,
                                        ...formData
                                    }]);
                                    if (error) throw error;
                                    await refreshLogs();
                                    if (refreshDashboardData) await refreshDashboardData();
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
                            staffList={staffList}
                            allUsers={allUsers}
                            onClose={() => setSelectedLog(null)}
                            onRefresh={async () => {
                                await refreshLogs();
                                if (refreshDashboardData) await refreshDashboardData();
                            }}
                            onDelete={async (id) => {
                                if (confirm('정말 삭제하시겠습니까?')) {
                                    try {
                                        await supabase.from('school_logs').delete().eq('id', id);
                                        await refreshLogs();
                                        if (refreshDashboardData) await refreshDashboardData();
                                        setSelectedLog(null);
                                    } catch (err) { alert('삭제 실패'); }
                                }
                            }}
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
                                    if (refreshDashboardData) await refreshDashboardData(); // Refresh global user data
                                    setSelectedStudent(null);
                                } catch (err) {
                                    alert('학생 정보 저장 실패: ' + err.message);
                                }
                            }}
                            onMergeComplete={async () => {
                                await refreshLogs();
                                if (refreshDashboardData) await refreshDashboardData();
                                setSelectedStudent(null);
                            }}
                            allUsers={allUsers}
                        />
                    )}
                </AnimatePresence>

                {/* Log Selector Modal for Calling Forest */}
                <AnimatePresence>
                    {selectorState.isOpen && (
                        <LogSelectorModal
                            student={selectorState.student}
                            schoolLogs={logs}
                            onClose={() => setSelectorState({ isOpen: false, student: null, week: null })}
                            onSelect={handleLinkLog}
                        />
                    )}
                </AnimatePresence>

                {/* Add Temporary Student Modal */}
                <AnimatePresence>
                    {isAddTempStudentModalOpen && (
                        <div
                            className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                            onClick={() => setIsAddTempStudentModalOpen(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                                onClick={e => e.stopPropagation()}
                                className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
                            >
                                <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <Plus size={18} className="text-amber-500" /> 임시 학생 추가
                                    </h3>
                                    <button onClick={() => setIsAddTempStudentModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-xs font-bold leading-relaxed mb-4">
                                        아직 가입하지 않은 청소년을 임시로 학생 목록에 추가하여 일지 기록 등의 사역 관리를 할 수 있습니다. 
                                        추후 청소년이 앱에 가입하면 계정을 연동시킬 수 있습니다.
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="space-y-1.5 flex-[4]">
                                            <label className="text-xs font-bold text-gray-600">학생 이름</label>
                                            <input
                                                type="text"
                                                value={newTempStudentName}
                                                onChange={(e) => setNewTempStudentName(e.target.value)}
                                                placeholder="이름 입력"
                                                maxLength={5}
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleAddTempStudent();
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1.5 flex-[6]">
                                            <label className="text-xs font-bold text-gray-600">연락처 (선택)</label>
                                            <input
                                                type="text"
                                                value={newTempStudentPhone}
                                                onChange={(e) => setNewTempStudentPhone(e.target.value)}
                                                placeholder="예: 01012345678"
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleAddTempStudent();
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleAddTempStudent}
                                        disabled={!newTempStudentName.trim() || addingTempStudent}
                                        className="w-full mt-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {addingTempStudent ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />} 임시 학생 등록하기
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

const LogFormModal = ({ school, onClose, onSave, staffList }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        start_time: '17:00',
        end_time: '18:30',
        location: '',
        participant_ids: [],
        facilitator_ids: [],
        content: ''
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [facilitatorSearchTerm, setFacilitatorSearchTerm] = useState('');

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const { selectionStart, selectionEnd, value } = e.target;
            const newValue = value.substring(0, selectionStart) + '\n* ' + value.substring(selectionEnd);

            setFormData(prev => ({
                ...prev,
                content: newValue
            }));

            // Cursor positioning after state update (using timeout to ensure DOM update)
            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = selectionStart + 3;
            }, 0);
        }
    };

    const filteredStudents = school.students.filter(s =>
        s.name.includes(searchTerm) || s.phone?.includes(searchTerm)
    );

    const toggleParticipant = (id) => {
        setFormData(prev => ({
            ...prev,
            participant_ids: prev.participant_ids.includes(id)
                ? prev.participant_ids.filter(pid => pid !== id)
                : [...prev.participant_ids, id]
        }));
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-0 md:p-8"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-white w-full max-w-2xl h-full md:h-auto md:max-h-[90vh] rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <Plus size={20} />
                        </div>
                        <h3 className="text-xl font-black text-gray-800 tracking-tighter">새 사역일지 작성</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 space-y-6 md:space-y-8">
                    {/* Date & Time */}
                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-1.5">
                                <Calendar size={12} /> 날짜
                            </label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full p-2.5 md:p-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner text-base"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-1.5">
                                <Clock size={12} /> 시작
                            </label>
                            <input
                                type="time"
                                value={formData.start_time}
                                onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                className="w-full p-2.5 md:p-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner text-base"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-1.5">
                                <Clock size={12} /> 종료
                            </label>
                            <input
                                type="time"
                                value={formData.end_time}
                                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                className="w-full p-2.5 md:p-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner text-base"
                            />
                        </div>
                    </div>

                    {/* Participants (Multi-select with search) */}
                    <div className="space-y-2 md:space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                <Users size={12} /> 참여자 선택 ({formData.participant_ids.length})
                            </label>
                            <div className="relative w-1/2 max-w-[160px]">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                                <input
                                    type="text"
                                    placeholder="학생 검색..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-6 pr-2 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-base md:text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 md:gap-2 max-h-[140px] md:max-h-[160px] overflow-y-auto no-scrollbar p-1">
                            {filteredStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => toggleParticipant(student.id)}
                                    className={`flex items-center gap-1.5 md:gap-2 p-1.5 md:p-2 rounded-xl text-[10px] font-black transition-all border ${formData.participant_ids.includes(student.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}
                                >
                                    <span className="truncate">{student.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Facilitators (Multi-select) */}
                    <div className="space-y-4 md:space-y-5">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-indigo-500 uppercase ml-1 flex items-center gap-2">
                                    <User size={12} /> 스태프 지정
                                </label>
                                <div className="relative w-1/2 max-w-[160px]">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                                    <input
                                        type="text"
                                        placeholder="이름 검색..."
                                        value={facilitatorSearchTerm}
                                        onChange={e => setFacilitatorSearchTerm(e.target.value)}
                                        className="w-full pl-6 pr-2 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-base md:text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 relative">
                                {staffList?.filter(s => school.metadata?.manager_ids?.includes(s.id)).map(staff => (
                                    <button
                                        key={staff.id}
                                        onClick={() => {
                                            setFormData(prev => ({
                                                ...prev,
                                                facilitator_ids: prev.facilitator_ids?.includes(staff.id)
                                                    ? prev.facilitator_ids.filter(id => id !== staff.id)
                                                    : [...(prev.facilitator_ids || []), staff.id]
                                            }));
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all border ${formData.facilitator_ids?.includes(staff.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-indigo-100 hover:bg-indigo-50'}`}
                                    >
                                        <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden">
                                            {staff.profile_image_url ? <img src={staff.profile_image_url} className="w-full h-full object-cover" /> : <User size={12} />}
                                        </div>
                                        <span>{staff.name}</span>
                                    </button>
                                ))}
                                {(!staffList?.some(s => school.metadata?.manager_ids?.includes(s.id))) && (
                                    <div className="text-xs text-gray-300 font-bold px-2 py-1 flex-1">지정된 매니저 없음</div>
                                )}
                                {/* Search Results Dropdown */}
                                {facilitatorSearchTerm && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-20 p-2 max-h-[160px] overflow-y-auto no-scrollbar">
                                        {staffList?.filter(s => !school.metadata?.manager_ids?.includes(s.id) && s.name.toLowerCase().includes(facilitatorSearchTerm.toLowerCase())).map(staff => (
                                            <button
                                                key={staff.id}
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        facilitator_ids: prev.facilitator_ids?.includes(staff.id)
                                                            ? prev.facilitator_ids // Already selected
                                                            : [...(prev.facilitator_ids || []), staff.id]
                                                    }));
                                                    setFacilitatorSearchTerm(''); // Clear search after selection
                                                }}
                                                className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg text-left group"
                                            >
                                                <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                                                    {staff.profile_image_url ? <img src={staff.profile_image_url} className="w-full h-full object-cover" /> : <User size={12} className="text-gray-400 group-hover:text-indigo-500 py-0.5" />}
                                                </div>
                                                <span className="text-xs font-bold text-gray-600 group-hover:text-indigo-600">{staff.name}</span>
                                                {formData.facilitator_ids?.includes(staff.id) && <span className="ml-auto text-[10px] text-indigo-500 font-bold">선택됨</span>}
                                            </button>
                                        ))}
                                        {staffList?.filter(s => !school.metadata?.manager_ids?.includes(s.id) && s.name.toLowerCase().includes(facilitatorSearchTerm.toLowerCase())).length === 0 && (
                                            <div className="text-center py-2 text-xs text-gray-400">검색 결과가 없습니다.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Selected Other Staff Display */}
                            {staffList?.filter(s => !school.metadata?.manager_ids?.includes(s.id) && formData.facilitator_ids?.includes(s.id)).length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {staffList?.filter(s => !school.metadata?.manager_ids?.includes(s.id) && formData.facilitator_ids?.includes(s.id)).map(staff => (
                                        <button
                                            key={staff.id}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    facilitator_ids: prev.facilitator_ids.filter(id => id !== staff.id)
                                                }));
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all border bg-indigo-600 text-white border-indigo-600 shadow-md hover:bg-indigo-700"
                                        >
                                            <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden">
                                                {staff.profile_image_url ? <img src={staff.profile_image_url} className="w-full h-full object-cover" /> : <User size={12} />}
                                            </div>
                                            <span>{staff.name}</span>
                                            <X size={12} className="ml-1 opacity-60 hover:opacity-100" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Location */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <MapPin size={12} /> 활동 장소
                        </label>
                        <input
                            type="text"
                            placeholder="예: 매점, 학교 정문 등"
                            value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className="w-full p-3 md:p-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner text-base md:text-sm"
                        />
                    </div>

                    <TemplateManager
                        type="MINISTRY_LOG"
                        currentContent={formData.content}
                        onSelect={(content) => setFormData(prev => ({ ...prev, content }))}
                        currentAdmin={JSON.parse(localStorage.getItem('admin_user'))}
                    />

                    {/* Notepad Content Editor */}
                    <div className="space-y-2 md:space-y-3 pb-20 md:pb-0">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <FileText size={12} /> 사역 내용 (메모장 스타일)
                        </label>
                        <textarea
                            value={formData.content}
                            onKeyDown={handleKeyDown}
                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                            className="w-full h-[300px] md:h-[400px] p-5 md:p-6 bg-gray-50 border border-gray-100 rounded-[1.5rem] md:rounded-[2rem] font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-400 transition-all shadow-inner resize-none text-base md:text-[13px] leading-relaxed"
                            placeholder={`여기에 내용을 입력하세요...\n* 엔터 입력 시 불렛 자동 생성\n* 쉬프트+엔터로 일반 줄바꿈`}
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 md:p-8 bg-gray-50/50 border-t border-gray-100 flex gap-4 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 bg-white border border-gray-200 text-gray-400 rounded-2xl font-black text-sm hover:bg-gray-100 transition-all active:scale-95"
                    >
                        취소
                    </button>
                    <button
                        onClick={() => {
                            onSave({
                                date: formData.date,
                                time_range: `${formData.start_time}~${formData.end_time}`,
                                location: formData.location,
                                participant_ids: formData.participant_ids,
                                facilitator_ids: formData.facilitator_ids,
                                content: formData.content
                            });
                        }}
                        className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Save size={18} /> 사역일지 저장
                    </button>
                </div>
            </motion.div>
        </motion.div >
    );
};

const MarkdownRenderer = ({ content }) => {
    if (!content) return <p className="text-gray-300 italic">내용이 없습니다.</p>;

    const SECTION_COLORS = {
        '근황': { border: 'border-indigo-500', bg: 'bg-indigo-50/30' },
        '스쿨처치': { border: 'border-emerald-500', bg: 'bg-emerald-50/30' },
        '기도제목': { border: 'border-amber-500', bg: 'bg-amber-50/30' },
        '추후방향': { border: 'border-rose-500', bg: 'bg-rose-50/30' },
        '향후 일정': { border: 'border-rose-500', bg: 'bg-rose-50/30' }
    };

    const lines = content.split('\n');
    return (
        <div className="space-y-3">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                // Bold Title: **Title**
                if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                    const title = trimmed.replace(/\*\*/g, '');
                    const style = SECTION_COLORS[title] || { border: 'border-gray-400', bg: 'bg-gray-50/50' };

                    return (
                        <div key={idx} className={`text-[13px] font-black text-gray-900 mt-5 first:mt-0 mb-2 flex items-center gap-2 border-l-[3px] ${style.border} pl-3 ${style.bg} py-1.5 rounded-r-lg shadow-sm/10`}>
                            {title}
                        </div>
                    );
                }
                // Bullet Point: * text
                if (trimmed.startsWith('*')) {
                    return (
                        <div key={idx} className="flex gap-2.5 group ml-0.5 px-0.5">
                            <div className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-indigo-300" />
                            <p className="text-[12.5px] font-bold text-gray-700 leading-relaxed">
                                {trimmed.replace(/^\*/, '').trim()}
                            </p>
                        </div>
                    );
                }
                // Empty line
                if (trimmed === '') return <div key={idx} className="h-1" />;

                // Regular line
                return (
                    <p key={idx} className="text-[12.5px] font-bold text-gray-500 ml-4 pl-0.5 leading-relaxed">
                        {trimmed}
                    </p>
                );
            })}
        </div>
    );
};

const LogDetailModal = ({ logs, initialLogId, school, onClose, onRefresh, onDelete, allUsers, staffList }) => {
    const scrollContainerRef = useRef(null);
    const logRefs = useRef({});
    const [editingLogs, setEditingLogs] = useState({}); // {logId: {...logData, start_time, end_time} }
    const [savingId, setSavingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState({});
    const [facilitatorSearchTerm, setFacilitatorSearchTerm] = useState({});

    useEffect(() => {
        if (initialLogId && logRefs.current[initialLogId]) {
            setTimeout(() => {
                logRefs.current[initialLogId].scrollIntoView({ behavior: 'auto', block: 'start' });
            }, 100);
        }
    }, [initialLogId]);

    const handleSaveEdit = async (logId) => {
        const editData = editingLogs[logId];
        if (!editData) return;

        setSavingId(logId);
        try {
            const time_range = `${editData.start_time || ''}~${editData.end_time || ''}`;
            const { error } = await supabase.from('school_logs').update({
                date: editData.date,
                time_range: time_range,
                location: editData.location,
                participant_ids: editData.participant_ids || [],
                facilitator_ids: editData.facilitator_ids || [],
                content: editData.content
            }).eq('id', logId);

            if (error) throw error;

            setEditingLogs(prev => {
                const next = { ...prev };
                delete next[logId];
                return next;
            });
            await onRefresh();
            alert('저장되었습니다.');
        } catch (err) {
            alert('저장 실패: ' + err.message);
        } finally {
            setSavingId(null);
        }
    };

    const handleKeyDown = (e, logId) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const { selectionStart, selectionEnd, value } = e.target;
            const newValue = value.substring(0, selectionStart) + '\n* ' + value.substring(selectionEnd);

            setEditingLogs(prev => ({
                ...prev,
                [logId]: { ...prev[logId], content: newValue }
            }));

            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = selectionStart + 3;
            }, 0);
        }
    };

    const toggleParticipant = (logId, studentId) => {
        setEditingLogs(prev => {
            const current = prev[logId].participant_ids || [];
            return {
                ...prev,
                [logId]: {
                    ...prev[logId],
                    participant_ids: current.includes(studentId)
                        ? current.filter(id => id !== studentId)
                        : [...current, studentId]
                }
            };
        });
    };

    const toggleFacilitator = (logId, staffId) => {
        setEditingLogs(prev => {
            const current = prev[logId].facilitator_ids || [];
            return {
                ...prev,
                [logId]: {
                    ...prev[logId],
                    facilitator_ids: current.includes(staffId)
                        ? current.filter(id => id !== staffId)
                        : [...current, staffId]
                }
            };
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-0 md:p-8"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-white w-full max-w-2xl h-full md:h-[90vh] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header - Fixed */}
                <div className="p-6 md:p-8 border-b border-gray-100 bg-white/80 backdrop-blur-md flex justify-between items-center shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <ClipboardList size={20} />
                        </div>
                        <h3 className="text-xl font-black text-gray-800 tracking-tighter">사역 일지 기록 피드</h3>
                    </div>
                    <button onClick={onClose} className="p-3 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50">
                    <div className="p-4 md:p-8 space-y-8">
                        {logs.map((log, index) => {
                            const isEditing = editingLogs[log.id] !== undefined;
                            const editData = editingLogs[log.id] || {};
                            const currentContent = isEditing ? editData.content : log.content;
                            const sTerm = searchTerm[log.id] || '';
                            const fTerm = facilitatorSearchTerm[log.id] || '';

                            const filteredStudents = (school?.students || []).filter(s =>
                                s.name.includes(sTerm) || s.phone?.includes(sTerm)
                            );

                            return (
                                <div
                                    key={log.id}
                                    ref={el => logRefs.current[log.id] = el}
                                    className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden scroll-mt-24"
                                >
                                    {/* Log Item Header */}
                                    <div className="p-6 md:p-8 border-b border-gray-50 bg-gray-50/30 flex justify-between items-start">
                                        <div className="space-y-3 flex-1">
                                            <div className="flex items-center gap-3">
                                                {isEditing ? (
                                                    <input
                                                        type="date"
                                                        value={editData.date || ''}
                                                        onChange={e => setEditingLogs(prev => ({ ...prev, [log.id]: { ...prev[log.id], date: e.target.value } }))}
                                                        className="px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-indigo-500 transition-colors shadow-sm"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-base">
                                                        <Calendar size={20} />
                                                        {log.date}
                                                    </div>
                                                )}
                                                <div className="px-3 py-1 bg-indigo-100/50 rounded-lg text-xs font-black text-indigo-600">
                                                    {logs.length - index}번째 일지
                                                </div>
                                            </div>
                                            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                                                {isEditing ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="time"
                                                            value={editData.start_time || ''}
                                                            onChange={e => setEditingLogs(prev => ({ ...prev, [log.id]: { ...prev[log.id], start_time: e.target.value } }))}
                                                            className="px-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 shadow-sm"
                                                        />
                                                        <span className="text-gray-400 font-bold">~</span>
                                                        <input
                                                            type="time"
                                                            value={editData.end_time || ''}
                                                            onChange={e => setEditingLogs(prev => ({ ...prev, [log.id]: { ...prev[log.id], end_time: e.target.value } }))}
                                                            className="px-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 shadow-sm"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-gray-400 font-bold text-sm">
                                                        <Clock size={16} />
                                                        {log.time_range}
                                                    </div>
                                                )}

                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        placeholder="장소 입력..."
                                                        value={editData.location || ''}
                                                        onChange={e => setEditingLogs(prev => ({ ...prev, [log.id]: { ...prev[log.id], location: e.target.value } }))}
                                                        className="flex-1 max-w-[200px] px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 shadow-sm"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-gray-400 text-sm font-bold">
                                                        <MapPin size={14} />
                                                        {log.location || '장소 미입력'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0 ml-4">
                                            {isEditing ? (
                                                <button
                                                    onClick={() => handleSaveEdit(log.id)}
                                                    disabled={savingId === log.id}
                                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    <Save size={14} />
                                                    저장
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        const [start_time = '', end_time = ''] = (log.time_range || '').split('~');
                                                        setEditingLogs(prev => ({
                                                            ...prev,
                                                            [log.id]: {
                                                                ...log,
                                                                start_time: start_time.trim(),
                                                                end_time: end_time.trim(),
                                                                participant_ids: log.participant_ids || [],
                                                                facilitator_ids: log.facilitator_ids || []
                                                            }
                                                        }));
                                                        setSearchTerm(prev => ({ ...prev, [log.id]: '' }));
                                                        setFacilitatorSearchTerm(prev => ({ ...prev, [log.id]: '' }));
                                                    }}
                                                    className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => onDelete(log.id)}
                                                className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-6 md:p-8 space-y-8">
                                        {/* Facilitators */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-widest ml-1">진행자</h4>
                                                {isEditing && (
                                                    <div className="relative w-1/2 max-w-[160px]">
                                                        <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                        <input
                                                            type="text"
                                                            placeholder="진행자 검색..."
                                                            value={fTerm}
                                                            onChange={e => setFacilitatorSearchTerm(prev => ({ ...prev, [log.id]: e.target.value }))}
                                                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {isEditing ? (
                                                <div className="flex flex-wrap gap-2 relative border border-gray-100 p-3 rounded-2xl bg-gray-50/50">
                                                    {(staffList || []).filter(s => school.metadata?.manager_ids?.includes(s.id)).map(staff => (
                                                        <button
                                                            key={staff.id}
                                                            onClick={() => toggleFacilitator(log.id, staff.id)}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${editData.facilitator_ids?.includes(staff.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-indigo-100 hover:bg-indigo-50'}`}
                                                        >
                                                            <span>{staff.name}</span>
                                                        </button>
                                                    ))}
                                                    {(!staffList?.some(s => school.metadata?.manager_ids?.includes(s.id))) && (
                                                        <div className="text-xs text-gray-300 font-bold px-2 py-1 flex-1">지정된 매니저 없음</div>
                                                    )}
                                                    {isEditing && fTerm && (
                                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-20 p-2 max-h-[160px] overflow-y-auto no-scrollbar">
                                                            {(staffList || []).filter(s => !school.metadata?.manager_ids?.includes(s.id) && s.name.toLowerCase().includes(fTerm.toLowerCase())).map(staff => (
                                                                <button
                                                                    key={staff.id}
                                                                    onClick={() => {
                                                                        toggleFacilitator(log.id, staff.id);
                                                                        setFacilitatorSearchTerm(prev => ({ ...prev, [log.id]: '' }));
                                                                    }}
                                                                    className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg text-left text-sm font-bold text-gray-700"
                                                                >
                                                                    <span>{staff.name}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {log.facilitator_ids?.length > 0 ? (
                                                        log.facilitator_ids.map(fid => {
                                                            const staff = staffList?.find(s => s.id === fid) || allUsers?.find(u => u.id === fid);
                                                            return (
                                                                <div key={fid} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-indigo-700">
                                                                    <span className="text-xs font-bold">{staff?.name || '정보 없음'}</span>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <p className="text-xs text-gray-300 font-bold italic">진행자 기록 없음</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Participants */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-widest ml-1">참여자</h4>
                                                {isEditing && (
                                                    <div className="relative w-1/2 max-w-[160px]">
                                                        <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                        <input
                                                            type="text"
                                                            placeholder="학생 검색..."
                                                            value={sTerm}
                                                            onChange={e => setSearchTerm(prev => ({ ...prev, [log.id]: e.target.value }))}
                                                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {isEditing ? (
                                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 md:gap-2 max-h-[140px] md:max-h-[160px] overflow-y-auto no-scrollbar p-1 border border-gray-100 rounded-2xl bg-gray-50/50 p-3">
                                                    {filteredStudents.map(student => (
                                                        <button
                                                            key={student.id}
                                                            onClick={() => toggleParticipant(log.id, student.id)}
                                                            className={`flex items-center justify-center p-1.5 md:p-2 rounded-xl text-[10px] font-black transition-all border ${editData.participant_ids?.includes(student.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                                        >
                                                            <span className="truncate">{student.name}</span>
                                                        </button>
                                                    ))}
                                                    {filteredStudents.length === 0 && (
                                                        <div className="col-span-full text-center text-xs text-gray-400 font-bold py-2">검색 결과가 없습니다.</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {log.participant_ids?.length > 0 ? (
                                                        log.participant_ids.map(pid => {
                                                            const student = school.students?.find(s => s.id === pid) || allUsers?.find(u => u.id === pid);
                                                            return (
                                                                <div key={pid} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
                                                                    <div className="w-5 h-5 rounded-lg bg-gray-200 flex items-center justify-center text-[9px] font-black text-gray-500">
                                                                        {student?.name?.charAt(0)}
                                                                    </div>
                                                                    <span className="text-xs font-bold text-gray-700">{student?.name || '정보 없음'}</span>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <p className="text-xs text-gray-300 font-bold italic">참여자 기록 없음</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Content Area - View/Edit Toggle */}
                                        <div className="space-y-3 relative group">
                                            <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-widest ml-1 flex items-center justify-between">
                                                <span>사역 내용</span>
                                                {isEditing && (
                                                    <div className="flex gap-2">
                                                        <span className="text-[9px] text-indigo-400 animate-pulse">편집 중...</span>
                                                        <button
                                                            onClick={() => {
                                                                setEditingLogs(prev => {
                                                                    const next = { ...prev };
                                                                    delete next[log.id];
                                                                    return next;
                                                                });
                                                            }}
                                                            className="text-[9px] text-gray-400 hover:text-red-500 font-black"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                )}
                                            </h4>

                                            {isEditing ? (
                                                <textarea
                                                    value={currentContent}
                                                    onKeyDown={(e) => handleKeyDown(e, log.id)}
                                                    onChange={(e) => {
                                                        setEditingLogs(prev => ({
                                                            ...prev,
                                                            [log.id]: { ...prev[log.id], content: e.target.value }
                                                        }));
                                                    }}
                                                    className="w-full p-6 rounded-[2rem] font-bold text-[13px] leading-relaxed transition-all outline-none resize-none min-h-[400px] bg-white border-2 border-indigo-400 shadow-xl"
                                                    placeholder="내용을 입력하세요..."
                                                />
                                            ) : (
                                                <div
                                                    className="w-full p-6 rounded-[2rem] bg-gray-50/50 border border-transparent hover:bg-white hover:border-gray-100 hover:shadow-lg transition-all cursor-default min-h-[100px]"
                                                >
                                                    <MarkdownRenderer content={log.content} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

import { Link as LinkIcon, AlertTriangle } from 'lucide-react';

const StudentDetailModal = ({ student, onClose, onSave, onMergeComplete, allUsers }) => {
    const [memo, setMemo] = useState(student.memo || '');
    const [isLeader, setIsLeader] = useState(student.is_leader || false);

    const isTemporary = student.preferences?.is_temporary;
    const [phone, setPhone] = useState(student.phone === '미가입' ? '' : (student.phone || ''));
    const [mergeTargetUserId, setMergeTargetUserId] = useState('');
    const [isMerging, setIsMerging] = useState(false);

    // Get list of registered youth users excluding the current temporary student
    const youthUsers = allUsers?.filter(u => u.user_group === '청소년' && !u.preferences?.is_temporary && u.id !== student.id) || [];

    const handleMerge = async () => {
        if (!mergeTargetUserId) {
            alert('연동할 정식 회원 계정을 선택해주세요.');
            return;
        }

        const targetUser = youthUsers.find(u => u.id === mergeTargetUserId);
        if (!targetUser) return;

        if (!confirm(`'${student.name}' 임시 학생의 모든 사역 기록을 정식 회원 '${targetUser.name}' 계정으로 연동하고 임시 계정을 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)`)) {
            return;
        }

        setIsMerging(true);
        try {
            // 1. Update school_logs
            // We need to fetch all logs where this temp student is a participant
            const { data: logsData, error: logsError } = await supabase
                .from('school_logs')
                .select('*')
                .contains('participant_ids', [student.id]);
            
            if (logsError) throw logsError;

            if (logsData && logsData.length > 0) {
                // For each log, replace the temp ID with the remote actual user ID
                const promises = logsData.map(log => {
                    const updatedParticipants = log.participant_ids.map(id => id === student.id ? targetUser.id : id);
                    // remove duplicates if target was already there somehow
                    const uniqueParticipants = [...new Set(updatedParticipants)];
                    return supabase.from('school_logs').update({ participant_ids: uniqueParticipants }).eq('id', log.id);
                });
                await Promise.all(promises);
            }

            // 2. Update calling_forest_progress
            const { error: cfError } = await supabase
                .from('calling_forest_progress')
                .update({ student_id: targetUser.id })
                .eq('student_id', student.id);
            if (cfError) throw cfError;

            // 3. Update target user's school if they don't have one
            if (!targetUser.school && student.school) {
                await supabase.from('users').update({ school: student.school }).eq('id', targetUser.id);
            }

            // 4. Delete temporary user record
            const { error: delError } = await supabase.from('users').delete().eq('id', student.id);
            if (delError) throw delError;

            alert('성공적으로 계정 기록이 병합되었습니다.');
            onMergeComplete();
        } catch (err) {
            alert('계정 병합 중 오류가 발생했습니다: ' + err.message);
        } finally {
            setIsMerging(false);
        }
    };

    const handleDeleteTempStudent = async () => {
        if (!confirm(`'${student.name}' 임시 학생을 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }
        setIsMerging(true);
        try {
            // Delete from school_logs mappings
            const { data: logsData } = await supabase.from('school_logs').select('*').contains('participant_ids', [student.id]);
            if (logsData && logsData.length > 0) {
                const promises = logsData.map(log => {
                    const filtered = log.participant_ids.filter(id => id !== student.id);
                    return supabase.from('school_logs').update({ participant_ids: filtered }).eq('id', log.id);
                });
                await Promise.all(promises);
            }
            
            // Delete calling_forest_progress
            await supabase.from('calling_forest_progress').delete().eq('student_id', student.id);

            // Delete user
            const { error } = await supabase.from('users').delete().eq('id', student.id);
            if (error) throw error;

            alert('임시 학생이 완전히 삭제되었습니다.');
            onMergeComplete();
        } catch (err) {
            alert('삭제 실패: ' + err.message);
        } finally {
            setIsMerging(false);
        }
    };

    const handleSave = () => {
        if (isLeader !== student.is_leader) {
            const confirmMsg = isLeader
                ? `[${student.name}] 학생을 리더로 지정하시겠습니까?`
                : `[${student.name}] 학생의 리더 지정을 해제하시겠습니까?`;

            if (!window.confirm(confirmMsg)) {
                // If user cancels, we still save the memo but revert the leader toggle
                // but usually user might want to stay in modal. Let's return.
                return;
            }
        }
        let updates = { memo, is_leader: isLeader };
        if (isTemporary) {
            let phoneVal = phone.trim() || '미가입';
            let phoneBack4Val = phoneVal !== '미가입' ? (phoneVal.length >= 4 ? phoneVal.slice(-4) : phoneVal) : '미가입';
            updates.phone = phoneVal;
            updates.phone_back4 = phoneBack4Val;
        }
        onSave(updates);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 bg-gradient-to-br from-indigo-500 to-indigo-600 relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                        <School size={120} />
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-0 right-0 w-24 h-24 flex items-start justify-end pt-6 pr-6 z-20 outline-none group"
                    >
                        <div className="bg-white/20 p-2.5 rounded-full text-white backdrop-blur-sm group-hover:bg-white/30 transition-colors shadow-sm">
                            <X size={20} />
                        </div>
                    </button>

                    <div className="flex flex-col items-center relative z-10">
                        <div className="w-24 h-24 rounded-full border-4 border-white/30 bg-white shadow-xl flex items-center justify-center overflow-hidden mb-4">
                            {student.profile_image_url ? (
                                <img src={student.profile_image_url} className="w-full h-full object-cover" />
                            ) : (
                                <User size={40} className="text-gray-300" />
                            )}
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">{student.name}</h2>
                        <div className="flex items-center gap-2 mt-1 opacity-90">
                            <span className="px-2 py-0.5 bg-white/20 rounded-lg text-xs font-bold text-white backdrop-blur-sm">
                                {student.school}
                            </span>
                            <span className="px-2 py-0.5 bg-white/20 rounded-lg text-xs font-bold text-white backdrop-blur-sm">
                                {student.birth || '생일 미입력'}
                            </span>
                        </div>
                        {student.phone && (
                            <div className="flex items-center gap-1.5 mt-2 bg-white/10 rounded-full px-3 py-1 text-xs font-bold text-white/90">
                                <span className="opacity-70">📞</span> {student.phone}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 bg-white overflow-y-auto custom-scrollbar md:max-h-[50vh]">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-1.5">
                            <Star size={12} /> 리더 권한 설정
                        </label>
                        <button
                            onClick={() => setIsLeader(!isLeader)}
                            className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between ${isLeader ? 'bg-yellow-50 border-yellow-200 text-yellow-700 shadow-sm' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLeader ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-300'}`}>
                                    <Star size={20} fill={isLeader ? "currentColor" : "none"} />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-black">{isLeader ? '학생 리더 지정됨' : '일반 학생'}</p>
                                    <p className="text-[10px] font-bold opacity-70">아이콘 및 필터링 시 리더로 표시됩니다.</p>
                                </div>
                            </div>
                            <div className={`w-12 h-6 rounded-full relative transition-colors ${isLeader ? 'bg-yellow-400' : 'bg-gray-200'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isLeader ? 'right-1' : 'left-1 shadow-sm'}`} />
                            </div>
                        </button>
                    </div>

                    {isTemporary ? (
                        <div className="space-y-3 bg-indigo-50/50 p-5 rounded-[1.5rem] border border-indigo-100">
                            <label className="text-[10px] font-black text-indigo-500 uppercase flex items-center gap-1.5 mb-1">
                                <LinkIcon size={12} /> 가입 계정과 기록 연동 (Merge)
                            </label>
                            
                            <div className="text-xs text-indigo-900/70 font-bold mb-4 flex gap-2 items-start opacity-80">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-indigo-400" />
                                <p>임시 데이터입니다. 실제 청소년이 가입한 계정을 선택하시면 각종 모든 활동 기록이 병합됩니다.</p>
                            </div>

                            <div className="space-y-4">
                                <select 
                                    className="w-full bg-white border border-indigo-200 text-gray-800 text-sm rounded-xl px-4 py-3 outline-none font-bold focus:ring-2 focus:ring-indigo-500/50"
                                    value={mergeTargetUserId}
                                    onChange={(e) => setMergeTargetUserId(e.target.value)}
                                >
                                    <option value="">연동할 가입 회원을 선택하세요</option>
                                    {youthUsers.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.name} ({u.school || '학교미지정'}, {u.phone?.slice(-4) || '번호없음'})
                                        </option>
                                    ))}
                                </select>
                                
                                <button
                                    onClick={handleMerge}
                                    disabled={!mergeTargetUserId || isMerging}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-black py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {isMerging ? '데이터 병합 및 최적화 중...' : '선택한 계정으로 통합하기'}
                                </button>
                            </div>

                            <div className="pt-5 mt-5 border-t border-indigo-200/50">
                                <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1.5 mb-2">
                                    <Trash2 size={12} /> 임시 계정 영구 삭제 (초기화)
                                </label>
                                <button
                                    onClick={handleDeleteTempStudent}
                                    disabled={isMerging}
                                    className="w-full bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 text-red-500 font-bold py-2.5 rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-red-100 flex items-center justify-center gap-1.5 text-xs"
                                >
                                    임시 학생 목록에서 완전히 제거하기
                                </button>
                                <p className="text-[10px] text-gray-400 font-bold mt-2 text-center opacity-80 leading-relaxed">
                                    삭제 시 관련된 모든 사역/참여 기록 내역에서도 함께 제외됩니다.<br/>
                                    주의해서 사용해주세요.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-1.5">
                                <FileText size={12} /> 관리자 메모 (특이사항)
                            </label>
                            <textarea
                                value={memo}
                                onChange={e => setMemo(e.target.value)}
                                className="w-full h-40 p-5 bg-yellow-50 border border-yellow-100 rounded-[1.5rem] text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-yellow-400/20 focus:border-yellow-300 resize-none shadow-inner leading-relaxed"
                                placeholder="학생에 대한 특이사항, 기도제목, 상담 내용 등을 자유롭게 기록하세요."
                            />
                        </div>
                    )}
                    
                    {isTemporary && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-1.5">
                                <FileText size={12} /> 연락처 입력 (선택)
                            </label>
                            <input
                                type="text"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                                placeholder="예: 01012345678"
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 bg-white border border-gray-200 text-gray-500 rounded-2xl font-black text-xs hover:bg-gray-100 transition-all"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Save size={16} /> 정보 저장
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default SchoolDetailModal;