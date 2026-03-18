import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Users, Clock, MapPin, Award, Filter, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { processAnalyticsData, processProgramAnalytics, processUserAnalytics } from '../utils/analyticsUtils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import SeucheoTimeAnalytics from './admin/statistics/analytics/SeucheoTimeAnalytics';
import ManagerAssignmentModal from './admin/statistics/analytics/ManagerAssignmentModal';
import { getKSTWeekOfMonth } from '../utils/dateUtils';

const AnalyticsTab = ({ logs, schoolLogs, locations, locationGroups = [], users, notices, responses, isLoading, fetchData }) => {
    // State for Filter
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-indexed
    const [selectedDay, setSelectedDay] = useState(new Date().getDate());
    const [periodType, setPeriodType] = useState('MONTHLY'); // 'MONTHLY', 'YEARLY', 'WEEKLY', 'DAILY'
    const [selectedLocationGroupId, setSelectedLocationGroupId] = useState('ALL');

    // ... (existing states omitted for brevity keep as is)

    // Premium Skeleton Component
    const Skeleton = () => (
        <div className="space-y-6">
            {/* Filter Skeleton */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4 animate-pulse">
                <div className="flex gap-2">
                    <div className="h-8 w-16 bg-gray-100 rounded-md"></div>
                    <div className="h-8 w-16 bg-gray-100 rounded-md"></div>
                    <div className="h-8 w-16 bg-gray-100 rounded-md"></div>
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-24 bg-gray-100 rounded-lg"></div>
                    <div className="h-10 w-24 bg-gray-100 rounded-lg"></div>
                    <div className="h-10 w-32 bg-gray-100 rounded-lg"></div>
                </div>
            </div>

            {/* KPI Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg"></div>
                            <div className="h-4 w-20 bg-gray-100 rounded"></div>
                        </div>
                        <div className="h-8 w-16 bg-gray-100 rounded mb-2"></div>
                        <div className="h-3 w-24 bg-gray-50 rounded"></div>
                    </div>
                ))}
            </div>

            {/* Charts Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col justify-between">
                    <div className="h-6 w-40 bg-gray-100 rounded mb-8"></div>
                    <div className="flex gap-4 items-end h-full">
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="flex-1 bg-gray-50 rounded-t" style={{ height: `${Math.random() * 80 + 20}%` }}></div>)}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col justify-between">
                    <div className="h-6 w-40 bg-gray-100 rounded mb-8"></div>
                    <div className="flex gap-4 items-end h-full">
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="flex-1 bg-gray-50 rounded-t" style={{ height: `${Math.random() * 80 + 20}%` }}></div>)}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80 md:col-span-2 flex flex-col justify-between">
                    <div className="h-6 w-40 bg-gray-100 rounded mb-8"></div>
                    <div className="w-full h-full bg-gray-50 rounded-lg"></div>
                </div>
            </div>
        </div>
    );

    // viewMode: 'SPACE', 'PROGRAM', 'USER', 'SEUCHEO'
    const [viewMode, setViewMode] = useState('SPACE');
    const [showGuestModal, setShowGuestModal] = useState(false);
    const [seucheoRegion, setSeucheoRegion] = useState('ALL'); // 'ALL', '강동', '강서'
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

    // ...
    const [selectedMemberForCalendar, setSelectedMemberForCalendar] = useState(null);
    const [selectedRoomDetails, setSelectedRoomDetails] = useState(null);
    const [userSort, setUserSort] = useState({ key: 'spaceDuration', order: 'desc' });
    const [userSearch, setUserSearch] = useState('');
    const [programFilter, setProgramFilter] = useState('ALL'); // 'ALL', 'CENTER', 'SCHOOL_CHURCH'

    const filteredLocations = useMemo(() => {
        if (!locationGroups || locationGroups.length === 0 || selectedLocationGroupId === 'ALL') return locations;
        return locations.filter(l => l.group_id === selectedLocationGroupId);
    }, [locations, locationGroups, selectedLocationGroupId]);

    const filteredLogsForSpace = useMemo(() => {
        if (!locationGroups || locationGroups.length === 0 || selectedLocationGroupId === 'ALL') return logs;
        const validLocationIds = new Set(filteredLocations.map(l => l.id));
        return logs.filter(l => !l.location_id || validLocationIds.has(l.location_id));
    }, [logs, filteredLocations, locationGroups, selectedLocationGroupId]);

    const spaceData = useMemo(() => {
        const currentDate = new Date(selectedYear, selectedMonth, selectedDay);
        return processAnalyticsData(filteredLogsForSpace, filteredLocations, users, currentDate, periodType);
    }, [filteredLogsForSpace, filteredLocations, users, selectedYear, selectedMonth, selectedDay, periodType]);

    const rawProgramData = useMemo(() => {
        const currentDate = new Date(selectedYear, selectedMonth, selectedDay);
        return processProgramAnalytics(notices, responses, currentDate, periodType);
    }, [notices, responses, selectedYear, selectedMonth, selectedDay, periodType]);

    const programData = useMemo(() => {
        if (programFilter === 'ALL') return rawProgramData;
        return rawProgramData.filter(p => (p.program_type || 'CENTER') === programFilter);
    }, [rawProgramData, programFilter]);

    const rawUserData = useMemo(() => {
        const currentDate = new Date(selectedYear, selectedMonth, selectedDay);
        return processUserAnalytics(users, logs, responses, notices, currentDate, periodType);
    }, [users, logs, responses, notices, selectedYear, selectedMonth, selectedDay, periodType]);

    const userData = useMemo(() => {
        let filtered = rawUserData.filter(u =>
            u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
            (u.school && u.school.toLowerCase().includes(userSearch.toLowerCase()))
        );

        return filtered.sort((a, b) => {
            const valA = a[userSort.key];
            const valB = b[userSort.key];
            return userSort.order === 'asc' ? valA - valB : valB - valA;
        });
    }, [rawUserData, userSort, userSearch]);

    const handleSort = (key) => {
        setUserSort(prev => ({
            key,
            order: prev.key === key && prev.order === 'desc' ? 'asc' : 'desc'
        }));
    };

    if (isLoading) return <Skeleton />;

    return (
        <div className="space-y-6">
            {/* Filter Section */}
            <section className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6 flex-wrap">
                    <div className="flex flex-wrap items-center gap-3 md:gap-4 min-w-0">
                        <div className="flex bg-gray-100 p-1 rounded-lg flex-wrap h-fit shadow-inner">
                            <button
                                onClick={() => setPeriodType('DAILY')}
                                className={`px-2.5 md:px-3 py-1.5 text-xs font-bold rounded-md transition h-[32px] flex items-center ${periodType === 'DAILY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                일간
                            </button>
                            <button
                                onClick={() => setPeriodType('WEEKLY')}
                                className={`px-2.5 md:px-3 py-1.5 text-xs font-bold rounded-md transition h-[32px] flex items-center ${periodType === 'WEEKLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                주간
                            </button>
                            <button
                                onClick={() => setPeriodType('MONTHLY')}
                                className={`px-2.5 md:px-3 py-1.5 text-xs font-bold rounded-md transition h-[32px] flex items-center ${periodType === 'MONTHLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                월간
                            </button>
                            <button
                                onClick={() => setPeriodType('YEARLY')}
                                className={`px-2.5 md:px-3 py-1.5 text-xs font-bold rounded-md transition h-[32px] flex items-center ${periodType === 'YEARLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                연간
                            </button>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="p-2 border border-gray-200 rounded-lg text-xs md:text-sm font-bold outline-none focus:border-blue-500 bg-white h-[40px] transition-colors"
                            >
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
                            </select>

                            {periodType !== 'YEARLY' && (
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                    className="p-2 border border-gray-200 rounded-lg text-xs md:text-sm font-bold outline-none focus:border-blue-500 bg-white h-[40px] transition-colors"
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i} value={i}>{i + 1}월</option>
                                    ))}
                                </select>
                            )}

                            {periodType === 'DAILY' && (
                                <select
                                    value={selectedDay}
                                    onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                                    className="p-2 border border-gray-200 rounded-lg text-xs md:text-sm font-bold outline-none focus:border-blue-500 bg-white h-[40px] transition-colors"
                                >
                                    {Array.from({ length: new Date(selectedYear, selectedMonth + 1, 0).getDate() }, (_, i) => (
                                        <option key={i + 1} value={i + 1}>{i + 1}일</option>
                                    ))}
                                </select>
                            )}

                            {periodType === 'WEEKLY' && (
                                <select
                                    value={getKSTWeekOfMonth(new Date(selectedYear, selectedMonth, selectedDay))}
                                    onChange={(e) => {
                                        const weekNum = parseInt(e.target.value);
                                        const firstOfMonth = new Date(selectedYear, selectedMonth, 1);
                                        const firstDay = firstOfMonth.getDay();
                                        const diffToFirstThursday = (firstDay <= 4 ? 4 - firstDay : 11 - firstDay);
                                        const firstThursday = new Date(selectedYear, selectedMonth, 1 + diffToFirstThursday);
                                        const targetDay = new Date(firstThursday);
                                        targetDay.setDate(firstThursday.getDate() + (weekNum - 1) * 7);
                                        if (targetDay.getMonth() === selectedMonth) {
                                            setSelectedDay(targetDay.getDate());
                                        }
                                    }}
                                    className="p-2 border border-blue-200 text-blue-700 rounded-lg text-xs md:text-sm font-bold outline-none focus:border-blue-500 bg-blue-50 h-[40px] transition-colors"
                                >
                                    {[1, 2, 3, 4, 5, 6].filter(w => {
                                        const firstOfMonth = new Date(selectedYear, selectedMonth, 1);
                                        const firstDay = firstOfMonth.getDay();
                                        const diffToFirstThursday = (firstDay <= 4 ? 4 - firstDay : 11 - firstDay);
                                        const firstThursday = new Date(selectedYear, selectedMonth, 1 + diffToFirstThursday);
                                        const targetDay = new Date(firstThursday);
                                        targetDay.setDate(firstThursday.getDate() + (w - 1) * 7);
                                        return targetDay.getMonth() === selectedMonth;
                                    }).map(w => (
                                        <option key={w} value={w}>{w}주차</option>
                                    ))}
                                </select>
                            )}

                            {viewMode === 'SPACE' && locationGroups && locationGroups.length > 0 && (
                                <select
                                    value={selectedLocationGroupId}
                                    onChange={(e) => setSelectedLocationGroupId(e.target.value)}
                                    className="p-2 border border-blue-200 text-blue-700 rounded-lg text-xs md:text-sm font-bold outline-none focus:border-blue-500 bg-blue-50 h-[40px] transition-colors"
                                >
                                    <option value="ALL">전체 그룹</option>
                                    {locationGroups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2 w-full lg:w-auto flex-wrap sm:flex-nowrap">
                        <button
                            onClick={() => setViewMode('SPACE')}
                            className={`flex-1 lg:flex-none px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold border transition h-[40px] flex items-center justify-center gap-1.5 whitespace-nowrap ${viewMode === 'SPACE' ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <MapPin size={16} /> 공간 분석
                        </button>
                        <button
                            onClick={() => setViewMode('PROGRAM')}
                            className={`flex-1 lg:flex-none px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold border transition h-[40px] flex items-center justify-center gap-1.5 whitespace-nowrap ${viewMode === 'PROGRAM' ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Calendar size={16} /> 프로그램 분석
                        </button>
                        <button
                            onClick={() => setViewMode('USER')}
                            className={`flex-1 lg:flex-none px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold border transition h-[40px] flex items-center justify-center gap-1.5 whitespace-nowrap ${viewMode === 'USER' ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Users size={16} /> 이용자 분석
                        </button>
                        <button
                            onClick={() => setViewMode('SEUCHEO')}
                            className={`flex-1 lg:flex-none px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold border transition h-[40px] flex items-center justify-center gap-1.5 whitespace-nowrap ${viewMode === 'SEUCHEO' ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Clock size={16} /> 스처타임
                        </button>
                    </div>
                </div>

                {/* Program Type Filter (Only visible in Program Mode) */}
                {viewMode === 'PROGRAM' && (
                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-3">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">분류 선택</span>
                        <div className="flex bg-gray-50 p-1 rounded-xl shadow-inner">
                            <button
                                onClick={() => setProgramFilter('ALL')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${programFilter === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                전체
                            </button>
                            <button
                                onClick={() => setProgramFilter('CENTER')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${programFilter === 'CENTER' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                센터 프로그램
                            </button>
                            <button
                                onClick={() => setProgramFilter('SCHOOL_CHURCH')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${programFilter === 'SCHOOL_CHURCH' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                스처 프로그램
                            </button>
                        </div>
                    </div>
                )}

                {/* Seucheo Region Filter */}
                {viewMode === 'SEUCHEO' && (
                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">권역 선택</span>
                            <div className="flex bg-gray-50 p-1 rounded-xl shadow-inner">
                                <button
                                    onClick={() => setSeucheoRegion('ALL')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${seucheoRegion === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    전체
                                </button>
                                <button
                                    onClick={() => setSeucheoRegion('강동')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${seucheoRegion === '강동' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    강동
                                </button>
                                <button
                                    onClick={() => setSeucheoRegion('강서')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${seucheoRegion === '강서' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    강서
                                </button>
                            </div>
                        </div>
                        {seucheoRegion !== 'ALL' && (
                            <button
                                onClick={() => setIsManagerModalOpen(true)}
                                className="px-4 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition shadow-sm flex items-center gap-1.5"
                            >
                                <Users size={14} /> 담당자 관리
                            </button>
                        )}
                    </div>
                )}
            </section>

            {/* Summary Cards */}
            {viewMode !== 'SEUCHEO' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {viewMode === 'SPACE' ? (
                        <>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Clock size={20} /></div>
                                    <h3 className="text-gray-500 text-sm font-bold">총 이용 시간</h3>
                                </div>
                                <p className="text-2xl font-bold text-gray-800">
                                    {(spaceData.roomAnalysis.reduce((acc, curr) => acc + curr.duration, 0) / 60).toFixed(1)} <span className="text-sm font-normal text-gray-400">시간</span>
                                </p>
                                <div className="mt-2 flex gap-2 text-[10px] font-bold">
                                    <span className="text-blue-500">재학생 {(spaceData.totalDurationSplit.student / 60).toFixed(1)}h</span>
                                    <span className="text-gray-300">|</span>
                                    {spaceData.totalDurationSplit.guest > 0 && (
                                        <>
                                            <span className="text-indigo-500">게스트 {(spaceData.totalDurationSplit.guest / 60).toFixed(1)}h</span>
                                            <span className="text-gray-300">|</span>
                                        </>
                                    )}
                                    <span className="text-orange-500">졸업생 {(spaceData.totalDurationSplit.graduate / 60).toFixed(1)}h</span>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><MapPin size={20} /></div>
                                    <h3 className="text-gray-500 text-sm font-bold">회원 방문 횟수</h3>
                                </div>
                                <p className="text-2xl font-bold text-gray-800">{spaceData.totalVisits} <span className="text-sm font-normal text-gray-400">회</span></p>
                                <div className="mt-2 flex gap-2 text-[10px] font-bold">
                                    <span className="text-green-600">재학생 {spaceData.totalVisitsSplit.student}회</span>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-orange-500">졸업생 {spaceData.totalVisitsSplit.graduate}회</span>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Users size={20} /></div>
                                    <h3 className="text-gray-500 text-sm font-bold">회원 방문자 수</h3>
                                </div>
                                <p className="text-2xl font-bold text-gray-800">{spaceData.uniqueUsers} <span className="text-sm font-normal text-gray-400">명</span></p>
                                <div className="mt-2 flex gap-2 text-[10px] font-bold">
                                    <span className="text-purple-600">재학생 {spaceData.uniqueUsersSplit.student}명</span>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-orange-500">졸업생 {spaceData.uniqueUsersSplit.graduate}명</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowGuestModal(true)}
                                className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 bg-indigo-50/10 text-left hover:shadow-md transition group"
                            >
                               <div className="flex items-center gap-3 mb-2">
                                   <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition"><Users size={20} /></div>
                                   <h3 className="text-gray-500 text-sm font-bold">게스트 방문</h3>
                               </div>
                               <p className="text-2xl font-bold text-indigo-600">{spaceData.totalGuests} <span className="text-sm font-normal text-gray-400">건</span></p>
                           </button>
                        </>
                    ) : viewMode === 'PROGRAM' ? (
                        <>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Calendar size={20} /></div>
                                    <h3 className="text-gray-500 text-sm font-bold">
                                        {programFilter === 'ALL' ? '전체 프로그램' : programFilter === 'CENTER' ? '센터 프로그램' : '스처 프로그램'}
                                    </h3>
                                </div>
                                <p className="text-2xl font-bold text-gray-800">{programData.length} <span className="text-sm font-normal text-gray-400">개</span></p>
                                <div className="mt-2 flex gap-2 text-[10px] font-bold">
                                    {programFilter === 'ALL' ? (
                                        <>
                                            <span className="text-blue-500">센터 {rawProgramData.filter(p => (p.program_type || 'CENTER') === 'CENTER').length}</span>
                                            <span className="text-gray-300">|</span>
                                            <span className="text-purple-500">스처 {rawProgramData.filter(p => p.program_type === 'SCHOOL_CHURCH').length}</span>
                                        </>
                                    ) : (
                                        <span className="text-gray-400">해당 유형 분석 진행 중</span>
                                    )}
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Award size={20} /></div>
                                    <h3 className="text-gray-500 text-sm font-bold">누적 참여 인원</h3>
                                </div>
                                <p className="text-2xl font-bold text-gray-800">{programData.reduce((acc, curr) => acc + curr.joinCount, 0)} <span className="text-sm font-normal text-gray-400">명</span></p>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Users size={20} /></div>
                                    <h3 className="text-gray-500 text-sm font-bold">평균 출석률</h3>
                                </div>
                                <p className="text-2xl font-bold text-gray-800">
                                    {programData.filter(p => p.attendanceRate !== null).length > 0
                                        ? Math.round(programData.reduce((acc, curr) => acc + (curr.attendanceRate || 0), 0) / programData.filter(p => p.attendanceRate !== null).length)
                                        : 0}
                                    <span className="text-sm font-normal text-gray-400">%</span>
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={20} /></div>
                                    <h3 className="text-gray-500 text-sm font-bold">이용 회원 수</h3>
                                </div>
                                <p className="text-2xl font-bold text-gray-800">
                                    {rawUserData.filter(u => u.spaceCount > 0 || u.programCount > 0).length}
                                    <span className="text-sm font-normal text-gray-400 ml-1">/ {users.length} 명</span>
                                </p>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Clock size={20} /></div>
                                    <h3 className="text-gray-500 text-sm font-bold">실 이용자 평균 체류</h3>
                                </div>
                                <p className="text-2xl font-bold text-gray-800">
                                    {rawUserData.filter(u => u.spaceCount > 0).length > 0
                                        ? (rawUserData.reduce((acc, curr) => acc + curr.spaceDuration, 0) / rawUserData.filter(u => u.spaceCount > 0).length / 60).toFixed(1)
                                        : 0}
                                    <span className="text-sm font-normal text-gray-400">시간</span>
                                </p>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Award size={20} /></div>
                                    <h3 className="text-gray-500 text-sm font-bold">실 참여자 평균 프로그램</h3>
                                </div>
                                <p className="text-2xl font-bold text-gray-800">
                                    {rawUserData.filter(u => u.programCount > 0).length > 0
                                        ? (rawUserData.reduce((acc, curr) => acc + curr.programCount, 0) / rawUserData.filter(u => u.programCount > 0).length).toFixed(1)
                                        : 0}
                                    <span className="text-sm font-normal text-gray-400">회</span>
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {viewMode === 'SPACE' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Chart 1: Room Visitors - Donut + Detail */}
                    {(() => {
                        const PIE_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316'];
                        const totalVisitors = spaceData.roomAnalysis.reduce((acc, r) => acc + r.uniqueUsers, 0);
                        const totalDuration = spaceData.roomAnalysis.reduce((acc, r) => acc + r.duration, 0);

                        // Compute student/graduate split per room from userDetails
                        const roomSplits = spaceData.roomAnalysis.map(r => {
                            const students = r.userDetails?.filter(u => u.group !== '졸업생' && u.group !== '일반인' && u.group !== '게스트').length || 0;
                            const graduates = r.userDetails?.filter(u => u.group === '졸업생' || u.group === '일반인').length || 0;
                            return { students, graduates };
                        });

                        const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, index, value }) => {
                            if (value === 0) return null;
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            const pct = totalVisitors > 0 ? Math.round(value / totalVisitors * 100) : 0;
                            if (pct < 8) return null;
                            return (
                                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" style={{ fontSize: '11px', fontWeight: 900 }}>
                                    {value}
                                </text>
                            );
                        };

                        const renderDurationLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, index, value }) => {
                            if (value === 0) return null;
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            const pct = totalDuration > 0 ? Math.round(value / totalDuration * 100) : 0;
                            if (pct < 8) return null;
                            return (
                                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" style={{ fontSize: '10px', fontWeight: 900 }}>
                                    {(value / 60).toFixed(1)}h
                                </text>
                            );
                        };

                        return (
                            <>
                                {/* Visitors Chart */}
                                <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-baseline justify-between mb-4">
                                        <h3 className="text-base md:text-lg font-black text-gray-800">공간별 방문자 수</h3>
                                        <span className="text-xl md:text-2xl font-black text-blue-600">{totalVisitors}<span className="text-xs font-bold text-gray-400 ml-0.5">명</span></span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Donut */}
                                        <div className="w-36 h-36 md:w-44 md:h-44 shrink-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={spaceData.roomAnalysis}
                                                        dataKey="uniqueUsers"
                                                        nameKey="name"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius="50%"
                                                        outerRadius="90%"
                                                        paddingAngle={2}
                                                        onClick={(data) => setSelectedRoomDetails(data)}
                                                        className="cursor-pointer"
                                                        stroke="none"
                                                        label={renderCustomLabel}
                                                        labelLine={false}
                                                    >
                                                        {spaceData.roomAnalysis.map((_, i) => (
                                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Detail Cards */}
                                        <div className="flex-1 space-y-2 min-w-0">
                                            {spaceData.roomAnalysis.map((r, i) => {
                                                const split = roomSplits[i];
                                                const pct = totalVisitors > 0 ? Math.round(r.uniqueUsers / totalVisitors * 100) : 0;
                                                return (
                                                    <button
                                                        key={r.name}
                                                        onClick={() => setSelectedRoomDetails(r)}
                                                        className="w-full text-left p-2.5 md:p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
                                                    >
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                            <span className="text-sm md:text-base font-black text-gray-800 truncate">{r.name}</span>
                                                            <span className="ml-auto text-sm md:text-base font-black shrink-0" style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>{r.uniqueUsers}명</span>
                                                            <span className="text-[10px] font-bold text-gray-400 shrink-0">{pct}%</span>
                                                        </div>
                                                        {/* Student / Graduate bar */}
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                                                {split.students > 0 && (
                                                                    <div
                                                                        className="h-full bg-blue-400 rounded-l-full"
                                                                        style={{ width: `${(r.uniqueUsers > 0 ? (split.students / r.uniqueUsers) * 100 : 0)}%` }}
                                                                    />
                                                                )}
                                                                {split.graduates > 0 && (
                                                                    <div
                                                                        className="h-full bg-orange-400 rounded-r-full"
                                                                        style={{ width: `${(r.uniqueUsers > 0 ? (split.graduates / r.uniqueUsers) * 100 : 0)}%` }}
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="flex gap-1.5 text-[9px] font-bold shrink-0">
                                                                <span className="text-blue-500">재 {split.students}</span>
                                                                <span className="text-orange-500">졸 {split.graduates}</span>
                                                                {r.guestCount > 0 && <span className="text-gray-400">손 {r.guestCount}</span>}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Duration Chart */}
                                <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-baseline justify-between mb-4">
                                        <h3 className="text-base md:text-lg font-black text-gray-800">공간별 이용 시간</h3>
                                        <span className="text-xl md:text-2xl font-black text-purple-600">{(totalDuration / 60).toFixed(1)}<span className="text-xs font-bold text-gray-400 ml-0.5">시간</span></span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Donut */}
                                        <div className="w-36 h-36 md:w-44 md:h-44 shrink-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={spaceData.roomAnalysis}
                                                        dataKey="duration"
                                                        nameKey="name"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius="50%"
                                                        outerRadius="90%"
                                                        paddingAngle={2}
                                                        onClick={(data) => setSelectedRoomDetails(data)}
                                                        className="cursor-pointer"
                                                        stroke="none"
                                                        label={renderDurationLabel}
                                                        labelLine={false}
                                                    >
                                                        {spaceData.roomAnalysis.map((_, i) => (
                                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Detail Cards */}
                                        <div className="flex-1 space-y-2 min-w-0">
                                            {spaceData.roomAnalysis.map((r, i) => {
                                                const split = roomSplits[i];
                                                const durationHours = (r.duration / 60).toFixed(1);
                                                const pct = totalDuration > 0 ? Math.round(r.duration / totalDuration * 100) : 0;
                                                // Compute duration split per room
                                                const studentDuration = r.userDetails?.filter(u => u.group !== '졸업생' && u.group !== '일반인' && u.group !== '게스트').reduce((a, u) => a + u.duration, 0) || 0;
                                                const graduateDuration = r.userDetails?.filter(u => u.group === '졸업생' || u.group === '일반인').reduce((a, u) => a + u.duration, 0) || 0;
                                                const guestDuration = r.userDetails?.filter(u => u.group === '게스트').reduce((a, u) => a + u.duration, 0) || 0;
                                                return (
                                                    <button
                                                        key={r.name}
                                                        onClick={() => setSelectedRoomDetails(r)}
                                                        className="w-full text-left p-2.5 md:p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all group"
                                                    >
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                            <span className="text-sm md:text-base font-black text-gray-800 truncate">{r.name}</span>
                                                            <span className="ml-auto text-sm md:text-base font-black shrink-0" style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>{durationHours}h</span>
                                                            <span className="text-[10px] font-bold text-gray-400 shrink-0">{pct}%</span>
                                                        </div>
                                                        {/* Duration split bar */}
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                                                {studentDuration > 0 && (
                                                                    <div
                                                                        className="h-full bg-blue-400 rounded-l-full"
                                                                        style={{ width: `${(r.duration > 0 ? (studentDuration / r.duration) * 100 : 0)}%` }}
                                                                    />
                                                                )}
                                                                {graduateDuration > 0 && (
                                                                    <div
                                                                        className="h-full bg-orange-400 rounded-r-full"
                                                                        style={{ width: `${(r.duration > 0 ? (graduateDuration / r.duration) * 100 : 0)}%` }}
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="flex gap-1.5 text-[9px] font-bold shrink-0">
                                                                <span className="text-blue-500">재 {(studentDuration / 60).toFixed(1)}h</span>
                                                                <span className="text-orange-500">졸 {(graduateDuration / 60).toFixed(1)}h</span>
                                                                {guestDuration > 0 && <span className="text-gray-400">손 {(guestDuration / 60).toFixed(1)}h</span>}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </>
                        );
                    })()}

                    {/* Chart 3: Daily Activity Trend */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
                        <h3 className="text-lg font-bold text-gray-800 mb-6">
                            {periodType === 'DAILY' ? '시간별 이용 추이' :
                                periodType === 'WEEKLY' ? '주간 이용 추이' :
                                    periodType === 'MONTHLY' ? '일별 이용 추이' : '월별 이용 추이'}
                        </h3>
                        <div className="w-full h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={spaceData.timeSeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(date) => {
                                            const d = new Date(date);
                                            if (periodType === 'DAILY') return format(d, 'HH시');
                                            if (periodType === 'WEEKLY' || periodType === 'MONTHLY') return format(d, 'd일');
                                            return format(d, 'M월');
                                        }}
                                        tick={{ fontSize: 10 }}
                                        interval={window.innerWidth < 768 ? (periodType === 'DAILY' ? 3 : (periodType === 'MONTHLY' ? 4 : 2)) : 0}
                                    />
                                    <YAxis />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <Area type="monotone" dataKey="totalDuration" stroke="#8884d8" fillOpacity={1} fill="url(#colorDuration)" name="이용 시간(분)" />
                                    <Line type="monotone" dataKey="visitCount" stroke="#82ca9d" strokeWidth={2} name="방문 수" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Chart 4: Time/Day Heatmap */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2 overflow-x-auto">
                        <div className="flex justify-between items-center mb-6 min-w-[700px]">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">요일 및 시간대별 방문 혼잡도</h3>
                                <p className="text-xs font-medium text-gray-400 mt-1">선택한 기간 동안 각 요일/시간대에 발생한 총 체크인 및 방문 횟수</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                <span>여유</span>
                                <div className="flex gap-1">
                                    <div className="w-4 h-4 rounded bg-gray-50"></div>
                                    <div className="w-4 h-4 rounded bg-blue-200"></div>
                                    <div className="w-4 h-4 rounded bg-blue-400"></div>
                                    <div className="w-4 h-4 rounded bg-blue-600"></div>
                                    <div className="w-4 h-4 rounded bg-blue-800"></div>
                                </div>
                                <span>혼잡</span>
                            </div>
                        </div>
                        <div className="min-w-[700px]">
                            {/* Header row (Hours: 8 to 23) */}
                            <div className="flex mb-2">
                                <div className="w-10 shrink-0"></div>
                                <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                                    {Array.from({ length: 16 }).map((_, i) => (
                                        <div key={i + 8} className="text-[10px] font-bold text-gray-400 text-center">{i + 8}시</div>
                                    ))}
                                </div>
                            </div>
                            {/* Data rows (Days) */}
                            {['일', '월', '화', '수', '목', '금', '토'].map((dayName, dayIdx) => (
                                <div key={dayIdx} className="flex mb-1 items-center">
                                    <div className="w-10 shrink-0 text-xs font-bold text-gray-500">{dayName}</div>
                                    <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                                        {spaceData.heatmapData[dayIdx].slice(8, 24).map((count, i) => {
                                            const hourIdx = i + 8;
                                            let bgClass = 'bg-gray-50';
                                            let textClass = 'text-transparent';
                                            if (count > 0) {
                                                const ratio = count / (spaceData.maxHeatmapValue || 1);
                                                if (ratio > 0.8) { bgClass = 'bg-blue-800'; textClass = 'text-white'; }
                                                else if (ratio > 0.5) { bgClass = 'bg-blue-600'; textClass = 'text-white shadow-sm'; }
                                                else if (ratio > 0.2) { bgClass = 'bg-blue-400'; textClass = 'text-white'; }
                                                else { bgClass = 'bg-blue-200'; textClass = 'text-blue-800'; }
                                            }
                                            return (
                                                <div
                                                    key={hourIdx}
                                                    className={`h-8 lg:h-10 rounded flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all hover:ring-2 hover:ring-blue-400 hover:scale-105 cursor-pointer ${bgClass} ${textClass}`}
                                                    title={`${dayName}요일 ${hourIdx}시: ${count}명 방문`}
                                                >
                                                    {count > 0 ? count : ''}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : viewMode === 'PROGRAM' ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-lg font-bold text-gray-800">
                            {programFilter === 'ALL' ? '프로그램 참여 및 출석 현황' : programFilter === 'CENTER' ? '센터 프로그램 분석 상세' : '스처 프로그램 분석 상세'}
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="p-4">프로그램명</th>
                                    <th className="p-4 text-center">구분</th>
                                    <th className="p-4 text-center">신청 인원</th>
                                    <th className="p-4 text-center">출석 인원</th>
                                    <th className="p-4 text-center">출석률</th>
                                    <th className="p-4 text-center">상태</th>
                                    <th className="p-4 text-right">실행일</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {programData.length === 0 ? (
                                    <tr><td colSpan="6" className="p-8 text-center text-gray-400">신청 가능한 프로그램이 없습니다</td></tr>
                                ) : (
                                    programData.map((p) => (
                                        <tr key={p.id} className="hover:bg-gray-50/50 transition border-b border-gray-50 last:border-0">
                                            <td className="p-4 font-bold text-gray-700 max-w-[240px] leading-snug break-keep">
                                                {p.title}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${(p.program_type || 'CENTER') === 'CENTER' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                                    {(p.program_type || 'CENTER') === 'CENTER' ? '센터' : '스처'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center whitespace-nowrap">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold text-blue-600">{p.joinCount}명</span>
                                                    {p.waitlistCount > 0 && (
                                                        <span className="text-[10px] text-gray-400 font-bold">(대기 {p.waitlistCount}명)</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-bold text-green-600 whitespace-nowrap">{p.attendedCount}명</td>
                                            <td className="p-4 text-center min-w-[100px]">
                                                {p.attendanceRate !== null ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="font-bold">{p.attendanceRate}%</span>
                                                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-green-500" style={{ width: `${p.attendanceRate}%` }} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap inline-block ${p.program_status === 'ACTIVE' ? 'bg-blue-100 text-blue-600' : p.program_status === 'CANCELLED' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                    {p.program_status === 'ACTIVE' ? '진행중' : p.program_status === 'CANCELLED' ? '취소됨' : '종료됨'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right text-gray-400 font-mono text-xs whitespace-nowrap">
                                                {p.program_date ? format(parseISO(p.program_date), 'yyyy.MM.dd') : format(parseISO(p.created_at), 'yyyy.MM.dd')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : viewMode === 'SEUCHEO' ? (
                <SeucheoTimeAnalytics
                    schoolLogs={schoolLogs}
                    users={users}
                    periodType={periodType}
                    selectedDate={new Date(selectedYear, selectedMonth, selectedDay)}
                    regionFilter={seucheoRegion}
                />
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="text-lg font-bold text-gray-800">이용자 종합 분석</h3>
                        <div className="relative w-64 text-[10px] md:text-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="회원 검색..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="w-full pl-9 p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="p-4">이름</th>
                                    <th onClick={() => handleSort('spaceDuration')} className="p-4 cursor-pointer hover:text-blue-600 select-none">
                                        <div className="flex items-center gap-1">공간 시간 {userSort.key === 'spaceDuration' && (userSort.order === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />)}</div>
                                    </th>
                                    <th onClick={() => handleSort('spaceCount')} className="p-4 cursor-pointer hover:text-blue-600 select-none">
                                        <div className="flex items-center gap-1">공간 방문 {userSort.key === 'spaceCount' && (userSort.order === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />)}</div>
                                    </th>
                                    <th onClick={() => handleSort('programCount')} className="p-4 cursor-pointer hover:text-blue-600 select-none">
                                        <div className="flex items-center gap-1">프로그램 신청 {userSort.key === 'programCount' && (userSort.order === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />)}</div>
                                    </th>
                                    <th onClick={() => handleSort('attendedCount')} className="p-4 cursor-pointer hover:text-blue-600 select-none">
                                        <div className="flex items-center gap-1">실제 출석 {userSort.key === 'attendedCount' && (userSort.order === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />)}</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {userData.length === 0 ? (
                                    <tr><td colSpan="5" className="p-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
                                ) : (
                                    userData.map((user) => (
                                        <tr
                                            key={user.id}
                                            onClick={() => setSelectedMemberForCalendar(user)}
                                            className="hover:bg-blue-50/10 active:bg-blue-50/20 transition cursor-pointer"
                                        >
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-700">{user.name}</span>
                                                    <span className="text-[10px] text-gray-400">{user.group} | {user.school}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-blue-600 font-bold">{(user.spaceDuration / 60).toFixed(1)}시간</td>
                                            <td className="p-4 text-gray-600">{user.visitDaysCount}일 / {user.spaceCount}회</td>
                                            <td className="p-4 text-gray-600">{user.programCount}회</td>
                                            <td className="p-4 text-green-600 font-bold">{user.attendedCount}회</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Member Activity Calendar Modal */}
            {selectedMemberForCalendar && (
                <MemberActivityModal
                    member={selectedMemberForCalendar}
                    logs={logs}
                    year={selectedYear}
                    month={selectedMonth}
                    onClose={() => setSelectedMemberForCalendar(null)}
                />
            )}

            {/* Room Detailed Stats Modal */}
            {selectedRoomDetails && (
                <RoomMemberDetailModal
                    room={selectedRoomDetails}
                    year={selectedYear}
                    month={selectedMonth + 1}
                    day={selectedDay}
                    periodType={periodType}
                    onClose={() => setSelectedRoomDetails(null)}
                />
            )}

            {showGuestModal && (
                <GuestVisitDetailModal
                    spaceData={spaceData}
                    year={selectedYear}
                    month={selectedMonth + 1}
                    day={selectedDay}
                    periodType={periodType}
                    onClose={() => setShowGuestModal(false)}
                />
            )}

            {/* Manager Assignment Modal */}
            <ManagerAssignmentModal
                isOpen={isManagerModalOpen}
                onClose={() => setIsManagerModalOpen(false)}
                selectedRegion={seucheoRegion !== 'ALL' ? seucheoRegion : null}
                users={users}
                onSave={() => {
                    if (fetchData) {
                        fetchData(true);
                    }
                }}
            />
        </div>
    );
};

const MemberActivityModal = ({ member, logs, year, month, onClose }) => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Filter logs for this member
    const visitDates = useMemo(() => {
        const memberLogs = logs.filter(l => l.user_id === member.id && l.type === 'CHECKIN');
        return Array.from(new Set(memberLogs.map(l => format(parseISO(l.created_at), 'yyyy-MM-dd'))));
    }, [logs, member.id]);

    // Calendar Grid helper
    const startDay = monthStart.getDay(); // 0 (Sun) to 6 (Sat)
    const blanks = Array.from({ length: startDay }, (_, i) => i);

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">{member.name} <span className="text-sm font-normal text-gray-400">방문 이력</span></h3>
                        <p className="text-xs text-gray-500 font-bold">{year}년 {month + 1}월</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition text-gray-400 hover:text-gray-600">
                        <Award size={24} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {blanks.map(i => <div key={`blank-${i}`} />)}
                        {days.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const isVisited = visitDates.includes(dateStr);
                            const isToday = isSameDay(day, new Date());

                            return (
                                <div
                                    key={dateStr}
                                    className={`
                                        aspect-square flex items-center justify-center rounded-xl text-sm font-bold transition
                                        ${isVisited ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'}
                                        ${isToday ? 'border-2 border-blue-200' : ''}
                                    `}
                                >
                                    {day.getDate()}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-8 flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5 font-bold">
                            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                            <span className="text-gray-600">방문일</span>
                        </div>
                        <div className="text-gray-400">총 {visitDates.length}일 방문</div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="m-6 mt-0 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition"
                >
                    닫기
                </button>
            </div>
        </div>
    );
};

const RoomMemberDetailModal = ({ room, year, month, day, periodType, onClose }) => {
    const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'YOUTH', 'GRADUATE'

    const filteredUsers = useMemo(() => {
        if (filterType === 'ALL') return room.userDetails;
        if (filterType === 'GRADUATE') return room.userDetails.filter(u => u.group === '졸업생');
        if (filterType === 'YOUTH') return room.userDetails.filter(u => u.group !== '졸업생' && u.group !== '일반인'); // Includes '게스트', '재학생' etc.
        return room.userDetails;
    }, [room.userDetails, filterType]);

    const totalFilteredDuration = filteredUsers.reduce((acc, curr) => acc + curr.duration, 0);
    const totalFilteredCount = filteredUsers.length;

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-gray-100 flex flex-col gap-4 bg-gray-50/50">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">{room.name} <span className="text-sm font-normal text-gray-400">이용 상세</span></h3>
                            <p className="text-xs text-gray-500 font-bold">
                                {year}년 {
                                    periodType === 'DAILY' ? `${month}월 ${day}일` :
                                        periodType === 'WEEKLY' ? `${month}월 ${Math.ceil(day / 7)}주차` :
                                            periodType === 'MONTHLY' ? `${month}월` :
                                                '전체'
                                }
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition text-gray-400 hover:text-gray-600">
                            <MapPin size={24} />
                        </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit">
                        <button
                            onClick={() => setFilterType('ALL')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filterType === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            전체
                        </button>
                        <button
                            onClick={() => setFilterType('YOUTH')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filterType === 'YOUTH' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            청소년
                        </button>
                        <button
                            onClick={() => setFilterType('GRADUATE')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filterType === 'GRADUATE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            졸업생
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Desktop Table */}
                    <table className="hidden md:table w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold sticky top-0">
                            <tr>
                                <th className="p-4 w-12 text-center">#</th>
                                <th className="p-4">이름</th>
                                <th className="p-4">그룹</th>
                                <th className="p-4 text-center">방문 횟수</th>
                                <th className="p-4 text-center">총 이용 시간</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {!filteredUsers || filteredUsers.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
                            ) : (
                                filteredUsers.map((user, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition">
                                        <td className="p-4 text-center font-bold text-gray-400">{idx + 1}</td>
                                        <td className="p-4 font-bold text-gray-700">{user.name}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${user.group === '졸업생' ? 'bg-gray-100 text-gray-600' :
                                                user.group === '일반인' ? 'bg-orange-100 text-orange-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                {user.group || '재학생'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-gray-600 font-bold">{user.count}회</td>
                                        <td className="p-4 text-center text-blue-600 font-bold">{(user.duration / 60).toFixed(1)}시간</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Mobile Card Layout */}
                    <div className="md:hidden divide-y divide-gray-50">
                        {!filteredUsers || filteredUsers.length === 0 ? (
                            <div className="p-10 text-center text-gray-400 text-sm">데이터가 없습니다.</div>
                        ) : (
                            filteredUsers.map((user, idx) => (
                                <div key={idx} className="p-4 flex justify-between items-center transition active:bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-300 font-bold italic w-4">{idx + 1}</span>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{user.name}</p>
                                            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${user.group === '졸업생' ? 'bg-gray-100 text-gray-600' :
                                                user.group === '일반인' ? 'bg-orange-100 text-orange-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                {user.group || '재학생'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-blue-600 text-xs">{(user.duration / 60).toFixed(1)}시간</p>
                                        <p className="text-[10px] text-gray-400">{user.count}회 방문</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50/30 flex flex-col md:flex-row gap-4 justify-between items-center text-xs text-gray-400">
                    <div className="flex gap-4 font-bold">
                        <span>
                            {filterType === 'ALL' ? '총 이용자' : filterType === 'YOUTH' ? '청소년 이용자' : '졸업생 이용자'}: {' '}
                            <span className="text-gray-800">{totalFilteredCount}명</span>
                        </span>
                        <span>
                            {filterType === 'ALL' ? '총 시간' : filterType === 'YOUTH' ? '청소년 시간' : '졸업생 시간'}: {' '}
                            <span className="text-gray-800">{(totalFilteredDuration / 60).toFixed(1)}시간</span>
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-sm"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

const GuestVisitDetailModal = ({ spaceData, year, month, day, periodType, onClose }) => {
    const guests = useMemo(() => {
        const guestMap = new Map();
        spaceData.roomAnalysis.forEach(room => {
            room.userDetails.forEach(user => {
                if (user.group === '게스트') {
                    if (guestMap.has(user.name)) {
                        const existing = guestMap.get(user.name);
                        existing.count += user.count;
                        existing.duration += user.duration;
                    } else {
                        guestMap.set(user.name, { ...user });
                    }
                }
            });
        });
        return Array.from(guestMap.values()).sort((a, b) => b.duration - a.duration);
    }, [spaceData]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-gray-100 flex flex-col gap-4 bg-indigo-50/30">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-indigo-800">게스트 방문 <span className="text-sm font-normal text-indigo-400">이용 상세</span></h3>
                            <p className="text-xs text-indigo-500 font-bold">
                                {year}년 {
                                    periodType === 'DAILY' ? `${month}월 ${day}일` :
                                        periodType === 'WEEKLY' ? `${month}월 ${Math.ceil(day / 7)}주차` :
                                            periodType === 'MONTHLY' ? `${month}월` :
                                                '전체'
                                }
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition text-indigo-400 hover:text-indigo-600">
                            <Users size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <table className="hidden md:table w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold sticky top-0">
                            <tr>
                                <th className="p-4 w-12 text-center">#</th>
                                <th className="p-4">이름</th>
                                <th className="p-4">그룹</th>
                                <th className="p-4 text-center">방문 횟수</th>
                                <th className="p-4 text-center">총 이용 시간</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {guests.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-400">방문한 게스트가 없습니다.</td></tr>
                            ) : (
                                guests.map((guest, idx) => (
                                    <tr key={idx} className="hover:bg-indigo-50/30 transition">
                                        <td className="p-4 text-center font-bold text-gray-400">{idx + 1}</td>
                                        <td className="p-4 font-bold text-gray-700">{guest.name}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-600">
                                                게스트
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-gray-600 font-bold">{guest.count}회</td>
                                        <td className="p-4 text-center text-indigo-600 font-bold">{(guest.duration / 60).toFixed(1)}시간</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    <div className="md:hidden divide-y divide-gray-50">
                        {guests.length === 0 ? (
                            <div className="p-10 text-center text-gray-400 text-sm">방문한 게스트가 없습니다.</div>
                        ) : (
                            guests.map((guest, idx) => (
                                <div key={idx} className="p-4 flex justify-between items-center transition active:bg-indigo-50">
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-300 font-bold italic w-4">{idx + 1}</span>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{guest.name}</p>
                                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-indigo-100 text-indigo-600">
                                                게스트
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-indigo-600 text-xs">{(guest.duration / 60).toFixed(1)}시간</p>
                                        <p className="text-[10px] text-gray-400">{guest.count}회 방문</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center text-xs text-gray-400">
                    <div className="flex gap-4 font-bold">
                        <span>총 게스트 수: <span className="text-gray-800">{guests.length}명</span></span>
                        <span>총 이용 건수: <span className="text-indigo-600">{guests.reduce((acc, g) => acc + g.count, 0)}건</span></span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsTab;
