import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { School, Users, MapPin, ClipboardList, Settings, Plus, Search, X, Trash2, Save, ChevronRight, User, Calendar, Tag, MoreHorizontal, Clock, MapPin as LocationIcon, FileText } from 'lucide-react';
import { SCHOOL_REGIONS, CLUB_TYPES } from '../../constants/appConstants';
import { motion, AnimatePresence } from 'framer-motion';

const MINISTRY_LOG_TEMPLATE = `**근황**
* 

**스쿨처치**
* 

**기도제목**
* 

**추후방향**
* `;

const AdminSchool = ({ users, fetchData: refreshDashboardData }) => {
    const [schools, setSchools] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isSettingsMode, setIsSettingsMode] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState('ALL');

    useEffect(() => {
        fetchSchoolsAndLogs();
    }, []);

    const fetchSchoolsAndLogs = async () => {
        setLoading(true);
        try {
            const { data: schoolData } = await supabase.from('schools').select('*').order('name');
            const { data: logData } = await supabase.from('school_logs').select('*, users(name)').order('date', { ascending: false }, 'created_at', { ascending: false });
            setSchools(schoolData || []);
            setLogs(logData || []);
        } catch (err) {
            console.error('Data fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const schoolGroups = useMemo(() => {
        const adolescents = users.filter(u => u.user_group === '청소년');
        const groups = {};

        adolescents.forEach(u => {
            if (!u.school) return;
            const schoolMeta = schools.find(s => s.name === u.school);

            // Region filtering
            if (selectedRegion !== 'ALL' && schoolMeta?.region !== selectedRegion) return;

            if (!groups[u.school]) {
                groups[u.school] = {
                    name: u.school,
                    students: [],
                    metadata: schoolMeta || null
                };
            }
            groups[u.school].students.push(u);
        });

        // Also include schools with metadata but no current students if they match region
        schools.forEach(s => {
            if (selectedRegion !== 'ALL' && s.region !== selectedRegion) return;
            if (!groups[s.name]) {
                groups[s.name] = {
                    name: s.name,
                    students: [],
                    metadata: s
                };
            }
        });

        return Object.values(groups).filter(g =>
            g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (g.metadata?.club_name && g.metadata.club_name.toLowerCase().includes(searchTerm.toLowerCase()))
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [users, schools, searchTerm, selectedRegion]);

    const staffList = useMemo(() => users.filter(u => u.user_group === 'STAFF'), [users]);

    const handleOpenDetail = (group) => {
        setSelectedSchool(group);
        setIsDetailModalOpen(true);
        setIsSettingsMode(false);
    };

    const handleSaveMetadata = async (metadata) => {
        try {
            const existing = schools.find(s => s.name === selectedSchool.name);
            let result;
            if (existing) {
                result = await supabase.from('schools').update(metadata).eq('id', existing.id);
            } else {
                result = await supabase.from('schools').insert([{ ...metadata, name: selectedSchool.name }]);
            }

            if (result.error) throw result.error;
            await fetchSchoolsAndLogs();
            setIsSettingsMode(false);
            const updatedSchool = { ...selectedSchool, metadata: { ...selectedSchool.metadata, ...metadata } };
            setSelectedSchool(updatedSchool);
        } catch (err) {
            alert('저장 실패: ' + err.message);
        }
    };

    if (loading) return <div className="p-10 text-center font-bold text-gray-400 animate-pulse">학교 데이터를 불러오는 중...</div>;

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="p-6 md:p-10 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between bg-gradient-to-r from-white to-indigo-50/20">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-3">
                        <School className="text-indigo-600" size={32} />
                        학교 관리
                    </h2>
                    <p className="text-gray-500 text-sm font-medium mt-1">청소년 회원 소속 학교별 동아리 및 사역 일지 관리</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 lg:min-w-[500px] w-full lg:w-auto">
                    {/* Region Filter Buttons */}
                    <div className="flex bg-gray-100/50 p-1.5 rounded-2xl border border-gray-100 w-full sm:w-auto">
                        {['ALL', ...SCHOOL_REGIONS].map((region) => (
                            <button
                                key={region}
                                onClick={() => setSelectedRegion(region)}
                                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-xs transition-all ${selectedRegion === region ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {region === 'ALL' ? '전체' : region}
                            </button>
                        ))}
                    </div>

                    <div className="relative group w-full lg:min-w-[300px]">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="학교 또는 동아리 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-14 p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold text-gray-700 shadow-inner"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {schoolGroups.map((group) => (
                    <SchoolCard
                        key={group.name}
                        group={group}
                        onClick={() => handleOpenDetail(group)}
                    />
                ))}
            </div>

            <AnimatePresence>
                {isDetailModalOpen && selectedSchool && (
                    <SchoolDetailModal
                        school={selectedSchool}
                        logs={logs.filter(l => l.school_id === selectedSchool.metadata?.id)}
                        staffList={staffList}
                        onClose={() => setIsDetailModalOpen(false)}
                        isSettingsMode={isSettingsMode}
                        setIsSettingsMode={setIsSettingsMode}
                        onSaveMetadata={handleSaveMetadata}
                        refreshLogs={fetchSchoolsAndLogs}
                        refreshDashboardData={refreshDashboardData}
                        allUsers={users}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

const SchoolCard = ({ group, onClick }) => {
    const meta = group.metadata;
    return (
        <motion.div
            whileHover={{ y: -5, shadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
            onClick={onClick}
            className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm cursor-pointer transition-all hover:border-indigo-200"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <School size={24} />
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${meta?.region === '강동' ? 'bg-blue-100 text-blue-600' : meta?.region === '강서' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                    {meta?.region || '지역 미지정'}
                </span>
            </div>

            <h3 className="text-lg font-black text-gray-800 mb-1 truncate">{group.name}</h3>
            <p className="text-xs font-bold text-gray-400 mb-4">{meta?.club_name || '동아리 정보 없음'}</p>

            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-gray-500">
                    <Users size={14} />
                    <span className="text-xs font-bold">{group.students.length}명</span>
                </div>
                <div className="flex -space-x-2">
                    {group.students.slice(0, 3).map((s, i) => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500 overflow-hidden">
                            {s.profile_image_url ? <img src={s.profile_image_url} className="w-full h-full object-cover" /> : s.name?.charAt(0)}
                        </div>
                    ))}
                    {group.students.length > 3 && (
                        <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-400">
                            +{group.students.length - 3}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

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
                                                        {student.profile_image_url ? <img src={student.profile_image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-gray-300 bg-gray-50 uppercase">{student.name?.charAt(0)}</div>}
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
                        />
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

const LogFormModal = ({ school, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        start_time: '17:00',
        end_time: '18:30',
        location: '',
        participant_ids: [],
        content: MINISTRY_LOG_TEMPLATE
    });
    const [searchTerm, setSearchTerm] = useState('');

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
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8">
                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 col-span-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                <Calendar size={12} /> 날짜
                            </label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                <Clock size={12} /> 시작 시간
                            </label>
                            <input
                                type="time"
                                value={formData.start_time}
                                onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                <Clock size={12} /> 종료 시간
                            </label>
                            <input
                                type="time"
                                value={formData.end_time}
                                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    {/* Participants (Multi-select with search) */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <Users size={12} /> 참여자 선택 ({formData.participant_ids.length}명 선택됨)
                        </label>
                        <div className="relative mb-3">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                            <input
                                type="text"
                                placeholder="학생 이름 검색..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[160px] overflow-y-auto no-scrollbar p-1">
                            {filteredStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => toggleParticipant(student.id)}
                                    className={`flex items-center gap-2 p-2 rounded-xl text-[10px] font-black transition-all border ${formData.participant_ids.includes(student.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}
                                >
                                    <span className="truncate">{student.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Location */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <LocationIcon size={12} /> 활동 장소
                        </label>
                        <input
                            type="text"
                            placeholder="예: 학교 매점, 정문 앞, 센터 프로그램실 등"
                            value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner"
                        />
                    </div>

                    {/* Notepad Content Editor */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <FileText size={12} /> 사역 내용 (메모장 스타일)
                        </label>
                        <textarea
                            value={formData.content}
                            onKeyDown={handleKeyDown}
                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                            className="w-full h-[400px] p-6 bg-gray-50 border border-gray-100 rounded-[2rem] font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-400 transition-all shadow-inner resize-none text-[13px] leading-relaxed"
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
                                content: formData.content
                            });
                        }}
                        className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Save size={18} /> 사역일지 저장
                    </button>
                </div>
            </motion.div>
        </motion.div>
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

const LogDetailModal = ({ logs, initialLogId, school, onClose, onRefresh, onDelete, allUsers }) => {
    const scrollContainerRef = useRef(null);
    const logRefs = useRef({});
    const [editingContent, setEditingContent] = useState({}); // { logId: content }
    const [savingId, setSavingId] = useState(null);

    useEffect(() => {
        if (initialLogId && logRefs.current[initialLogId]) {
            setTimeout(() => {
                logRefs.current[initialLogId].scrollIntoView({ behavior: 'auto', block: 'start' });
            }, 100);
        }
    }, [initialLogId]);

    const handleSaveEdit = async (logId) => {
        const content = editingContent[logId];
        if (content === undefined) return;

        setSavingId(logId);
        try {
            await supabase.from('school_logs').update({ content }).eq('id', logId);
            // We don't necessarily need to refresh the whole dashboard here if we want to be fast,
            // but let's assume the parent should refresh or we update locally.
            // For now, let's just clear the editing state to show it's saved.
            setEditingContent(prev => {
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

            setEditingContent(prev => ({
                ...prev,
                [logId]: newValue
            }));

            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = selectionStart + 3;
            }, 0);
        }
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
                            const isEditing = editingContent[log.id] !== undefined;
                            const currentContent = isEditing ? editingContent[log.id] : log.content;

                            return (
                                <div
                                    key={log.id}
                                    ref={el => logRefs.current[log.id] = el}
                                    className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden scroll-mt-24"
                                >
                                    {/* Log Item Header */}
                                    <div className="p-6 md:p-8 border-b border-gray-50 bg-gray-50/30 flex justify-between items-start">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-base">
                                                    <Calendar size={20} />
                                                    {log.date}
                                                </div>
                                                <div className="px-3 py-1 bg-indigo-100/50 rounded-lg text-xs font-black text-indigo-600">
                                                    {index + 1}번째 일지
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-4 items-center">
                                                <div className="flex items-center gap-2 text-gray-400 font-bold text-sm">
                                                    <Clock size={16} />
                                                    {log.time_range}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-gray-400 text-sm font-bold">
                                                    <MapPin size={14} />
                                                    {log.location || '장소 미입력'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {isEditing && (
                                                <button
                                                    onClick={() => handleSaveEdit(log.id)}
                                                    disabled={savingId === log.id}
                                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    <Save size={14} />
                                                    저장
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
                                        {/* Participants */}
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-widest ml-1">참여자</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {log.participant_ids?.length > 0 ? (
                                                    log.participant_ids.map(pid => {
                                                        const student = school.students.find(s => s.id === pid) || allUsers?.find(u => u.id === pid);
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
                                        </div>

                                        {/* Content Area - View/Edit Toggle */}
                                        <div className="space-y-3 relative group">
                                            <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-widest ml-1 flex items-center justify-between">
                                                <span>사역 내용</span>
                                                {isEditing ? (
                                                    <div className="flex gap-2">
                                                        <span className="text-[9px] text-indigo-400 animate-pulse">편집 중...</span>
                                                        <button
                                                            onClick={() => {
                                                                setEditingContent(prev => {
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
                                                ) : (
                                                    <span className="text-[9px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">클릭하여 수정</span>
                                                )}
                                            </h4>

                                            {isEditing ? (
                                                <textarea
                                                    autoFocus
                                                    value={currentContent}
                                                    onKeyDown={(e) => handleKeyDown(e, log.id)}
                                                    onChange={(e) => {
                                                        setEditingContent(prev => ({ ...prev, [log.id]: e.target.value }));
                                                    }}
                                                    className="w-full p-6 rounded-[2rem] font-bold text-[13px] leading-relaxed transition-all outline-none resize-none min-h-[400px] bg-white border-2 border-indigo-400 shadow-xl"
                                                    placeholder="내용을 입력하세요..."
                                                />
                                            ) : (
                                                <div
                                                    onClick={() => setEditingContent(prev => ({ ...prev, [log.id]: log.content || '' }))}
                                                    className="w-full p-6 rounded-[2rem] bg-gray-50/50 border border-transparent hover:bg-white hover:border-gray-100 hover:shadow-lg transition-all cursor-text min-h-[100px]"
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

const StudentDetailModal = ({ student, onClose, onSave }) => {
    const [memo, setMemo] = useState(student.memo || '');

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
                        className="absolute top-4 right-4 p-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors backdrop-blur-sm z-10"
                    >
                        <X size={20} />
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
                        onClick={() => onSave({ memo })}
                        className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Save size={16} /> 메모 저장
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default AdminSchool;
