import React from 'react';
import { Calendar, Users, Clock, MapPin, Award, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Line } from 'recharts';
import { getKSTWeekOfMonth } from '../../../../../utils/dateUtils';

const ProgramAnalyticsView = ({ hookData, users, schoolLogs }) => {
    const { selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, selectedDay, setSelectedDay, periodType, setPeriodType, selectedLocationGroupId, setSelectedLocationGroupId, viewMode, setViewMode, showGuestModal, setShowGuestModal, seucheoRegion, setSeucheoRegion, isManagerModalOpen, setIsManagerModalOpen, selectedMemberForCalendar, setSelectedMemberForCalendar, selectedRoomDetails, setSelectedRoomDetails, userSort, setUserSort, userSearch, setUserSearch, programFilter, setProgramFilter, filteredLocations, filteredLogsForSpace, spaceData, rawProgramData, programData, rawUserData, userData, handleSort } = hookData;

    if (!hookData) return null;

    return (
        <>
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
        </>
    );
};

export default ProgramAnalyticsView;
