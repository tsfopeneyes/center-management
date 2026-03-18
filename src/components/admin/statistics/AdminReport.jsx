import React, { useState } from 'react';
import { analyticsUtils } from '../../../utils/analyticsUtils';
import { getKSTWeekOfMonth } from '../../../utils/dateUtils';
import { FileText, Download, Calendar, Mail, CheckCircle, Clock, TrendingUp, RefreshCw, Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import SeucheoTimeAnalytics from './analytics/SeucheoTimeAnalytics';

const GuestListModal = ({ isOpen, onClose, spaceName, guests }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 z-[120] flex items-center justify-center p-4 backdrop-blur-lg animate-fade-in">
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative border border-gray-100 flex flex-col max-h-[80vh]"
            >
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div>
                        <h3 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                            <Users className="text-indigo-600" />
                            {spaceName} 게스트 명단
                        </h3>
                        <p className="text-sm font-bold text-gray-400 mt-1">총 {guests.length}명의 게스트가 방문했습니다.</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-50 text-gray-400 hover:text-gray-600 rounded-xl transition">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                    {guests.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 font-bold">방문한 게스트가 없습니다.</div>
                    ) : (
                        guests.map((g, idx) => (
                            <div key={idx} className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center border border-gray-100">
                                <div>
                                    <p className="font-black text-gray-800 text-lg">{g.name}</p>
                                    <p className="text-xs font-bold text-gray-500">{g.school} | {g.phone}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-indigo-600">{g.visits}회 방문</p>
                                    <p className="text-xs font-bold text-gray-400">총 {Math.floor(g.duration / 60)}h {g.duration % 60}m</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </motion.div>
        </div>
    );
};

const AdminReport = ({ allLogs, users, locations, notices }) => {
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedDay, setSelectedDay] = useState(new Date().getDate());
    const [periodType, setPeriodType] = useState('MONTHLY'); // 'MONTHLY', 'YEARLY', 'WEEKLY', 'DAILY'
    const [targetGroup, setTargetGroup] = useState('YOUTH'); // 'ALL', 'YOUTH'

    // Guest List Modal State
    const [selectedGuestSpace, setSelectedGuestSpace] = useState(null);

    const generateReport = async () => {
        setLoading(true);
        try {
            const currentDate = new Date(selectedYear, selectedMonth, selectedDay);
            let start, end;

            if (periodType === 'DAILY') {
                start = startOfDay(currentDate);
                end = endOfDay(currentDate);
            } else if (periodType === 'WEEKLY') {
                start = startOfWeek(currentDate, { weekStartsOn: 1 });
                end = endOfWeek(currentDate, { weekStartsOn: 1 });
            } else if (periodType === 'MONTHLY') {
                start = startOfMonth(currentDate);
                end = endOfMonth(currentDate);
            } else {
                start = new Date(selectedYear, 0, 1);
                end = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
            }

            const result = analyticsUtils.processOperationReport(allLogs, users, locations, start, end, targetGroup);
            setReport(result);
        } catch (err) {
            console.error(err);
            alert('리포트 생성 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <div className="p-4 md:p-10 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-4 lg:gap-6 items-start lg:items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
                <div className="flex items-center justify-between w-full lg:w-auto">
                    <div>
                        <h2 className="text-xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-2 md:gap-3">
                            <FileText className="text-blue-600" size={24} />
                            운영 데이터 리포트
                        </h2>
                        <p className="hidden md:block text-gray-500 text-sm font-medium mt-1">센터 이용 및 프로그램 참여 통계를 리포트 형식으로 추출합니다.</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 w-full xl:w-auto">
                    <div className="flex flex-wrap gap-2 items-center justify-end">
                        <div className="flex bg-white border border-gray-200 rounded-xl overflow-x-auto p-1 gap-1 scrollbar-hide shrink-0">
                            <button
                                onClick={() => setTargetGroup('ALL')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition whitespace-nowrap ${targetGroup === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                전체 (청소년+졸업생)
                            </button>
                            <button
                                onClick={() => setTargetGroup('YOUTH')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition whitespace-nowrap ${targetGroup === 'YOUTH' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                청소년만
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center justify-end">
                        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner shrink-0">
                            <button
                                onClick={() => setPeriodType('DAILY')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${periodType === 'DAILY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                일간
                            </button>
                            <button
                                onClick={() => setPeriodType('WEEKLY')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${periodType === 'WEEKLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                주간
                            </button>
                            <button
                                onClick={() => setPeriodType('MONTHLY')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${periodType === 'MONTHLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                월간
                            </button>
                            <button
                                onClick={() => setPeriodType('YEARLY')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${periodType === 'YEARLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                연간
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="p-2 border border-gray-200 rounded-xl text-xs md:text-sm font-bold outline-none focus:border-blue-500 bg-white transition-colors"
                            >
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
                            </select>

                            {periodType !== 'YEARLY' && (
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                    className="p-2 border border-gray-200 rounded-xl text-xs md:text-sm font-bold outline-none focus:border-blue-500 bg-white transition-colors"
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
                                    className="p-2 border border-gray-200 rounded-xl text-xs md:text-sm font-bold outline-none focus:border-blue-500 bg-white transition-colors"
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
                                    className="p-2 border border-blue-200 text-blue-700 rounded-xl text-xs md:text-sm font-bold outline-none focus:border-blue-500 bg-blue-50 transition-colors"
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
                        </div>

                        <button
                            onClick={generateReport}
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2 shrink-0"
                        >
                            <FileText size={18} />
                            {loading ? '생성 중...' : '리포트 생성'}
                        </button>
                    </div>
                </div>
            </div>

            {report ? (
                <div className="space-y-6">
                    {/* Monthly KPI Logic */}
                    {report.monthlyMetrics && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <CheckCircle size={20} className="text-white/80" />
                                        <span className="text-sm font-bold uppercase tracking-wider text-white/70">활성 이용자 비율</span>
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <span className="text-6xl font-black">{report.monthlyMetrics.activeUserRatio}%</span>
                                    </div>
                                    <p className="mt-4 text-sm text-indigo-100 leading-relaxed font-bold">
                                        최근 4주 내 주 평균 2회 이상 방문하거나<br />
                                        2주 이상 꾸준히 참여한 학생들의 비율입니다.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <RefreshCw size={20} className="text-white/80" />
                                        <span className="text-sm font-bold uppercase tracking-wider text-white/70">재방문율</span>
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <span className="text-6xl font-black">{report.monthlyMetrics.retentionRate}%</span>
                                    </div>
                                    <p className="mt-4 text-sm text-emerald-50 text-emerald-50/80 leading-relaxed font-bold">
                                        기간 내 1회 이상 방문한 학생 중<br />
                                        2회 이상 다시 찾아온 학생의 비율입니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Space-by-Space Analysis */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {report.spaceResults.map((space, idx) => (
                            <motion.div
                                key={space.name}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-xl font-black text-gray-800">{space.name}</h3>
                                    <div className="bg-gray-100 px-3 py-1 rounded-lg text-xs font-bold text-gray-500">
                                        {space.uniqueVisitors}명 이용 중
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                    <div className="space-y-1 border-l-4 border-blue-500 pl-4">
                                        <p className="text-[10px] font-black text-gray-400 uppercase">순 방문자</p>
                                        <p className="text-xl font-black text-gray-800">{space.uniqueVisitors}명</p>
                                    </div>
                                    <div className="space-y-1 border-l-4 border-indigo-500 pl-4 font-bold">
                                        <p className="text-[10px] font-black text-gray-400 uppercase">방문 수</p>
                                        <p className="text-xl font-black text-gray-800">{space.visitCount}회</p>
                                        <p className="text-[10px] text-gray-400">인당 평균 {space.avgVisitCount}회</p>
                                    </div>
                                    <div className="space-y-1 border-l-4 border-emerald-500 pl-4">
                                        <p className="text-[10px] font-black text-gray-400 uppercase">체류 시간</p>
                                        <p className="text-xl font-black text-gray-800">
                                            {Math.floor(space.totalDuration / 60)}h {space.totalDuration % 60}m
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-bold">평균 {space.avgDuration}분</p>
                                    </div>
                                    {space.activeUserRatio !== undefined && space.activeUserRatio !== null && (
                                        <>
                                            <div className="space-y-1 border-l-4 border-blue-600 pl-4">
                                                <p className="text-[10px] font-black text-gray-400 uppercase">활성 이용자 비율</p>
                                                <p className="text-xl font-black text-gray-800">{space.activeUserRatio}%</p>
                                            </div>
                                            <div className="space-y-1 border-l-4 border-teal-500 pl-4">
                                                <p className="text-[10px] font-black text-gray-400 uppercase">재방문율</p>
                                                <p className="text-xl font-black text-gray-800">{space.retentionRate}%</p>
                                            </div>
                                        </>
                                    )}
                                    <div className="space-y-1 border-l-4 border-orange-500 pl-4">
                                        <p className="text-[10px] font-black text-gray-400 uppercase">최다 방문 요일</p>
                                        <p className="text-xl font-black text-gray-800">{space.mostVisitedDay}요일</p>
                                    </div>
                                    <div className="space-y-1 border-l-4 border-purple-500 pl-4 col-span-2">
                                        <p className="text-[10px] font-black text-gray-400 uppercase">주요 체류 시간대</p>
                                        <p className="text-xl font-black text-gray-800">{space.peakHour}</p>
                                        <p className="text-[10px] text-gray-400 font-bold">가장 높은 동시 체류 인원</p>
                                    </div>

                                    {report.guestResults && report.guestResults[space.id] && report.guestResults[space.id].visitCount > 0 && (
                                        <div
                                            onClick={() => setSelectedGuestSpace({ name: space.name, ...report.guestResults[space.id] })}
                                            className="space-y-1 border-l-4 border-indigo-600 pl-4 bg-indigo-50/50 p-3 rounded-r-xl cursor-pointer hover:bg-indigo-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">게스트 방문 (클릭시 명단)</p>
                                                <TrendingUp size={10} className="text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                            </div>
                                            <p className="text-xl font-black text-indigo-700">{report.guestResults[space.id].visitCount}회</p>
                                            <p className="text-[10px] text-indigo-400 font-bold">총 {Math.floor(report.guestResults[space.id].totalDuration / 60)}h {report.guestResults[space.id].totalDuration % 60}m</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <AnimatePresence>
                        {selectedGuestSpace && (
                            <GuestListModal
                                isOpen={true}
                                onClose={() => setSelectedGuestSpace(null)}
                                spaceName={selectedGuestSpace.name}
                                guests={selectedGuestSpace.guests}
                            />
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border border-dashed border-gray-200 text-gray-300">
                    <Calendar size={48} strokeWidth={1} className="mb-4" />
                    <p className="font-bold">리포트를 생성하면 여기에 상세 통계가 표시됩니다.</p>
                </div>
            )}
        </div>
    );
};

export default AdminReport;
