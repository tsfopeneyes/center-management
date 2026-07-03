import React from 'react';
import { FileText } from 'lucide-react';
import { getKSTWeekOfMonth } from '../../../../utils/dateUtils';
import AdminPageHeader from '../../common/AdminPageHeader';

const ReportHeader = ({
    targetGroup, setTargetGroup,
    periodType, setPeriodType,
    selectedYear, setSelectedYear,
    selectedMonth, setSelectedMonth,
    selectedDay, setSelectedDay,
    generateReport, loading
}) => {
    const actions = (
        <div className="flex flex-col gap-3 w-full xl:w-auto">
            <div className="flex flex-wrap gap-2 items-center justify-end">
                <select
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    className="p-2 border border-blue-200 text-blue-800 rounded-xl text-xs md:text-sm font-bold outline-none focus:border-blue-500 bg-blue-50/50 transition-colors cursor-pointer shadow-sm"
                >
                    <option value="ALL">전체 (모든 이용자)</option>
                    <option value="YOUTH">청소년 (리더 포함)</option>
                    <option value="GRADUATE">졸업생</option>
                    <option value="LEADER_YOUTH">리더 청소년</option>
                    <option value="NON_LEADER_YOUTH">일반 청소년 (리더 제외)</option>
                </select>
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
    );

    return (
        <AdminPageHeader
            title="운영 데이터 리포트"
            subtitle="센터 이용 및 프로그램 참여 통계를 리포트 형식으로 추출합니다."
            icon={<FileText />}
            actions={actions}
        />
    );
};

export default ReportHeader;
