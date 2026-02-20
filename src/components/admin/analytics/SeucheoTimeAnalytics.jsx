import React, { useMemo } from 'react';
import { processSeucheoAnalytics } from '../../../utils/analyticsUtils';

const SeucheoTimeAnalytics = ({ schoolLogs, users, periodType, selectedDate }) => {
    const data = useMemo(() => {
        return processSeucheoAnalytics(schoolLogs, users, periodType, selectedDate);
    }, [schoolLogs, users, periodType, selectedDate]);

    const { staffStats, schoolStats, timeGrouping, totalMeetings, totalStudentsMet, totalDuration } = data;

    // Helper to format duration (minutes) to "XH YM"
    const formatDuration = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
    };

    // Get all unique staff names that appear in the timeGrouping for the columns
    const allStaffNames = useMemo(() => {
        const names = new Set();
        Object.values(timeGrouping).forEach(dayData => {
            Object.keys(dayData).forEach(name => names.add(name));
        });
        return Array.from(names).sort();
    }, [timeGrouping]);

    // Sort time keys (dates)
    const sortedTimeKeys = Object.keys(timeGrouping).sort();

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                    <span className="text-gray-400 font-bold mb-2">총 만남 횟수</span>
                    <span className="text-4xl font-black text-blue-600">{totalMeetings}회</span>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                    <span className="text-gray-400 font-bold mb-2">총 만난 학생 수</span>
                    <span className="text-4xl font-black text-blue-600">{totalStudentsMet}명</span>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                    <span className="text-gray-400 font-bold mb-2">총 스처타임 (시간)</span>
                    <span className="text-4xl font-black text-blue-600">{formatDuration(totalDuration)}</span>
                </div>
            </div>

            {/* Staff Performance Table (Excel Style) */}
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6">스태프별 스처타임 활동 현황</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4 rounded-l-xl">날짜 / 기간</th>
                                {allStaffNames.map(name => (
                                    <th key={name} className="px-6 py-4 font-bold text-gray-700">{name}</th>
                                ))}
                                <th className="px-6 py-4 rounded-r-xl font-black text-gray-800">합계</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedTimeKeys.map(dateKey => {
                                const rowData = timeGrouping[dateKey];
                                const rowTotal = Object.values(rowData).reduce((a, b) => a + b, 0);
                                return (
                                    <tr key={dateKey} className="hover:bg-gray-50/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-600">{dateKey}</td>
                                        {allStaffNames.map(name => (
                                            <td key={`${dateKey}-${name}`} className="px-6 py-4 text-gray-600">
                                                {rowData[name] ? formatDuration(rowData[name]) : '-'}
                                            </td>
                                        ))}
                                        <td className="px-6 py-4 font-bold text-blue-600">{formatDuration(rowTotal)}</td>
                                    </tr>
                                );
                            })}
                            {/* Grand Total Row */}
                            <tr className="bg-blue-50/30 font-bold">
                                <td className="px-6 py-4 text-blue-800">전체 합계</td>
                                {allStaffNames.map(name => {
                                    const colTotal = sortedTimeKeys.reduce((acc, dateKey) => acc + (timeGrouping[dateKey][name] || 0), 0);
                                    return (
                                        <td key={`total-${name}`} className="px-6 py-4 text-blue-600">{formatDuration(colTotal)}</td>
                                    );
                                })}
                                <td className="px-6 py-4 text-blue-800 font-black">{formatDuration(totalDuration)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Staff Ranking */}
                <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">스태프 활동 순위</h3>
                    <div className="space-y-4">
                        {staffStats.map((staff, idx) => (
                            <div key={staff.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                                <div className="flex items-center gap-4">
                                    <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${idx < 3 ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                                        {idx + 1}
                                    </span>
                                    <div>
                                        <p className="font-bold text-gray-800">{staff.name}</p>
                                        <p className="text-xs text-gray-400">{staff.meetingCount}회 만남 / {staff.totalStudents}명 학생</p>
                                    </div>
                                </div>
                                <span className="font-bold text-blue-600">{formatDuration(staff.totalDuration)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* School Analysis */}
                <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">학교별 스처타임 현황</h3>
                    <div className="space-y-4">
                        {schoolStats.map((school, idx) => (
                            <div key={school.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-gray-600">{school.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-800">{formatDuration(school.totalDuration)}</p>
                                    <p className="text-xs text-gray-400">{school.totalStudents}명 학생</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SeucheoTimeAnalytics;
