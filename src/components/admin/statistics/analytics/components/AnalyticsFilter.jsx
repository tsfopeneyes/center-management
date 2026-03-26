import React from 'react';
import { Calendar, Users, Clock, MapPin } from 'lucide-react';
import { getKSTWeekOfMonth } from '../../../../../utils/dateUtils';

const AnalyticsFilter = ({ hookData }) => {
    const { 
        selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, selectedDay, setSelectedDay, 
        periodType, setPeriodType, selectedLocationGroupId, setSelectedLocationGroupId, 
        viewMode, setViewMode, seucheoRegion, setSeucheoRegion, 
        isManagerModalOpen, setIsManagerModalOpen, 
        programFilter, setProgramFilter, filteredLocations, locationGroups 
    } = hookData;

    return (
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
    );
};

export default AnalyticsFilter;
