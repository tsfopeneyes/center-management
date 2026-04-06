import React from 'react';
import { Calendar, Users, Clock, MapPin, Award, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Line } from 'recharts';
import { getKSTWeekOfMonth } from '../../../../../utils/dateUtils';
import { supabase } from '../../../../../supabaseClient';
import ProgramFeedbackDetailModal from '../modals/ProgramFeedbackDetailModal';
import { feedbackApi } from '../../../../../api/feedbackApi';

const ProgramAnalyticsView = ({ hookData, users, schoolLogs }) => {
    const [allFeedbacks, setAllFeedbacks] = React.useState({});
    const [selectedFeedbackProgram, setSelectedFeedbackProgram] = React.useState(null);

    React.useEffect(() => {
        // Fetch all program feedbacks on mount
        const fetchFeedbacks = async () => {
            try {
                const { data } = await supabase
                    .from('program_feedback')
                    .select('*, users(name, school)');
                if (data) {
                    const grouped = {};
                    data.forEach(f => {
                        if (!grouped[f.notice_id]) grouped[f.notice_id] = [];
                        grouped[f.notice_id].push(f);
                    });
                    setAllFeedbacks(grouped);
                }
            } catch (err) {
                console.error('Failed to fetch program feedbacks:', err);
            }
        };
        fetchFeedbacks();
    }, []);
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
                                    <th className="p-4 text-center">만족도/리뷰</th>
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
                                            <td className="p-4 text-center whitespace-nowrap">
                                                {allFeedbacks[p.id] && allFeedbacks[p.id].length > 0 ? (
                                                    <button
                                                        onClick={() => setSelectedFeedbackProgram({ program: p, feedbacks: allFeedbacks[p.id] })}
                                                        className="flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl transition-colors mx-auto group"
                                                    >
                                                        <div className="flex items-center gap-1 text-yellow-500 mb-0.5">
                                                            <Award size={12} className="fill-current" />
                                                            <span className="font-black text-xs text-gray-700">
                                                                {(allFeedbacks[p.id].reduce((sum, f) => sum + (f.q3_satisfaction || 0), 0) / allFeedbacks[p.id].length).toFixed(1)}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-blue-600 group-hover:underline">리뷰 {allFeedbacks[p.id].length}개 조회</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">리뷰 없음</span>
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

                {selectedFeedbackProgram && (
                    <ProgramFeedbackDetailModal
                        program={selectedFeedbackProgram.program}
                        feedbacks={selectedFeedbackProgram.feedbacks}
                        onClose={() => setSelectedFeedbackProgram(null)}
                    />
                )}
        </>
    );
};

export default ProgramAnalyticsView;
