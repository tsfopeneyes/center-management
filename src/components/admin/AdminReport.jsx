import React, { useState } from 'react';
import { analyticsUtils } from '../../utils/analyticsUtils';
import { FileText, Download, Calendar, Mail, CheckCircle, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const AdminReport = ({ allLogs, users, locations, notices }) => {
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [period, setPeriod] = useState('CUSTOM'); // WEEK, MONTH, YEAR, CUSTOM
    const [selectionMode, setSelectionMode] = useState('RANGE'); // 'RANGE', 'MONTH', 'YEAR'
    const [targetGroup, setTargetGroup] = useState('ALL'); // 'ALL', 'YOUTH'

    // Initial Date Range
    const [dateRange, setDateRange] = useState({
        start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    // Month/Year Select State
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const setPeriodPreset = (type) => {
        let start, end = new Date();
        setSelectionMode('RANGE'); // Using Preset means Range Mode in effect for API

        if (type === 'THIS_WEEK') {
            start = startOfWeek(new Date(), { weekStartsOn: 1 });
        } else if (type === 'LAST_WEEK') {
            const last = new Date(); last.setDate(last.getDate() - 7);
            start = startOfWeek(last, { weekStartsOn: 1 });
            end = endOfWeek(last, { weekStartsOn: 1 });
        } else if (type === 'THIS_MONTH') {
            start = startOfMonth(new Date());
        } else if (type === 'LAST_MONTH') {
            const last = new Date(); last.setMonth(last.getMonth() - 1);
            start = startOfMonth(last);
            end = endOfMonth(last);
        }

        setDateRange({
            start: format(start, 'yyyy-MM-dd'),
            end: format(end, 'yyyy-MM-dd')
        });
        setPeriod(type);
    };

    const handleMonthSelect = (e) => {
        const val = e.target.value; // yyyy-MM
        setSelectedMonth(val);
        const [y, m] = val.split('-').map(Number);
        const date = new Date(y, m - 1, 1);
        setDateRange({
            start: format(startOfMonth(date), 'yyyy-MM-dd'),
            end: format(endOfMonth(date), 'yyyy-MM-dd')
        });
        setPeriod('MONTH_PICK');
    };

    const handleYearSelect = (e) => {
        const y = parseInt(e.target.value);
        setSelectedYear(y);
        const start = new Date(y, 0, 1);
        const end = new Date(y, 11, 31);
        setDateRange({
            start: format(start, 'yyyy-MM-dd'),
            end: format(end, 'yyyy-MM-dd')
        });
        setPeriod('YEAR_PICK');
    };

    const generateReport = async () => {
        setLoading(true);
        try {
            const start = new Date(dateRange.start);
            const end = new Date(dateRange.end);

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
        <div className="space-y-6 animate-fade-in-up">
            <div className="p-6 md:p-10 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-3">
                        <FileText className="text-blue-600" size={32} />
                        운영 데이터 리포트
                    </h2>
                    <p className="text-gray-500 text-sm font-medium mt-1">센터 이용 및 프로그램 참여 통계를 리포트 형식으로 추출합니다.</p>
                </div>

                <div className="flex flex-col gap-3 w-full xl:w-auto">
                    {/* Top Row: Filters */}
                    <div className="flex flex-wrap gap-2 items-center justify-end">
                        {/* Target Group Toggle */}
                        <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden p-1 gap-1">
                            <button
                                onClick={() => setTargetGroup('ALL')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${targetGroup === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                전체 (청소년+졸업생)
                            </button>
                            <button
                                onClick={() => setTargetGroup('YOUTH')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${targetGroup === 'YOUTH' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                청소년만
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row: Date Selection & Generate */}
                    <div className="flex flex-wrap gap-2 items-center justify-end">
                        <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden p-1 gap-1">
                            <button onClick={() => { setSelectionMode('RANGE'); setPeriodPreset('THIS_WEEK'); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectionMode === 'RANGE' && period === 'THIS_WEEK' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>이번 주</button>
                            <button onClick={() => { setSelectionMode('RANGE'); setPeriodPreset('THIS_MONTH'); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectionMode === 'RANGE' && period === 'THIS_MONTH' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>이번 달</button>
                            <button onClick={() => { setSelectionMode('MONTH'); setPeriod('MONTH_PICK'); handleMonthSelect({ target: { value: selectedMonth } }); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectionMode === 'MONTH' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>월 선택</button>
                            <button onClick={() => { setSelectionMode('YEAR'); setPeriod('YEAR_PICK'); handleYearSelect({ target: { value: selectedYear } }); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectionMode === 'YEAR' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>연도 선택</button>
                            <button onClick={() => setSelectionMode('RANGE')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectionMode === 'RANGE' && (period === 'CUSTOM' || period.includes('LAST')) ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>직접 지정</button>
                        </div>

                        <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-xl font-bold text-gray-600 text-sm">
                            <Calendar size={14} className="text-gray-400" />

                            {selectionMode === 'RANGE' && (
                                <>
                                    <input
                                        type="date"
                                        value={dateRange.start}
                                        onChange={(e) => { setDateRange(prev => ({ ...prev, start: e.target.value })); setPeriod('CUSTOM'); }}
                                        className="bg-transparent outline-none w-[110px]"
                                    />
                                    <span className="text-gray-300">~</span>
                                    <input
                                        type="date"
                                        value={dateRange.end}
                                        onChange={(e) => { setDateRange(prev => ({ ...prev, end: e.target.value })); setPeriod('CUSTOM'); }}
                                        className="bg-transparent outline-none w-[110px]"
                                    />
                                </>
                            )}

                            {selectionMode === 'MONTH' && (
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={handleMonthSelect}
                                    className="bg-transparent outline-none"
                                />
                            )}

                            {selectionMode === 'YEAR' && (
                                <select
                                    value={selectedYear}
                                    onChange={handleYearSelect}
                                    className="bg-transparent outline-none pr-8"
                                >
                                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
                                </select>
                            )}
                        </div>

                        <button
                            onClick={generateReport}
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
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
                                    <div className="space-y-1 border-l-4 border-orange-500 pl-4">
                                        <p className="text-[10px] font-black text-gray-400 uppercase">최다 방문 요일</p>
                                        <p className="text-xl font-black text-gray-800">{space.mostVisitedDay}요일</p>
                                    </div>
                                    <div className="space-y-1 border-l-4 border-purple-500 pl-4 col-span-2">
                                        <p className="text-[10px] font-black text-gray-400 uppercase">주요 체류 시간대</p>
                                        <p className="text-xl font-black text-gray-800">{space.peakHour}</p>
                                        <p className="text-[10px] text-gray-400 font-bold">가장 높은 동시 체류 인원</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
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
