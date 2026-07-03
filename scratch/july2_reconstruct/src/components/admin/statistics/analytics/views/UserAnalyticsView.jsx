import React from 'react';
import { Calendar, Users, Clock, MapPin, Award, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Line } from 'recharts';
import { getKSTWeekOfMonth } from '../../../../../utils/dateUtils';

const UserAnalyticsView = ({ hookData, users, schoolLogs }) => {
    const { selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, selectedDay, setSelectedDay, periodType, setPeriodType, selectedLocationGroupId, setSelectedLocationGroupId, viewMode, setViewMode, showGuestModal, setShowGuestModal, seucheoRegion, setSeucheoRegion, isManagerModalOpen, setIsManagerModalOpen, selectedMemberForCalendar, setSelectedMemberForCalendar, selectedRoomDetails, setSelectedRoomDetails, userSort, setUserSort, userSearch, setUserSearch, programFilter, setProgramFilter, filteredLocations, filteredLogsForSpace, spaceData, rawProgramData, programData, rawUserData, userData, handleSort } = hookData;

    if (!hookData) return null;

    return (
        <>
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
        </>
    );
};

export default UserAnalyticsView;
