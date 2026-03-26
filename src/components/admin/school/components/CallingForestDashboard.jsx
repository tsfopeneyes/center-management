import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { Flame, Clock, Star } from 'lucide-react';
import ProgressBarCard from './ProgressBarCard';
import CompleterCard from './CompleterCard';

const CallingForestDashboard = ({ users, selectedRegion, schools, viewMode, onViewModeChange }) => {
    const [loading, setLoading] = useState(true);
    const [completers, setCompleters] = useState([]);
    const [inProgress, setInProgress] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                // Fetch all calling forest progress with the linked log
                // Specifically fetching the facilitator_ids from the linked log
                const { data, error } = await supabase
                    .from('calling_forest_progress')
                    .select('*, school_logs(facilitator_ids)');

                if (error) throw error;

                // Group by student
                const studentMap = {}; // {studentId: {completedWeeks: [], latestWeek: null, latestLog: null } }

                data.forEach(record => {
                    const sid = record.student_id;
                    if (!studentMap[sid]) {
                        studentMap[sid] = {
                            student_id: sid,
                            completedWeeks: [],
                            latestWeekIndex: 0,
                            latestLog: null
                        };
                    }

                    studentMap[sid].completedWeeks.push(record.week_number);

                    if (record.week_number > studentMap[sid].latestWeekIndex) {
                        studentMap[sid].latestWeekIndex = record.week_number;
                        studentMap[sid].latestLog = record.school_logs;
                    }
                });

                const comp = [];
                const inProg = [];

                // Get all leaders for the selected region to calculate total leaders
                const allLeadersInRegion = users.filter(u => {
                    if (!u.is_leader) return false;
                    const schoolMeta = schools.find(s => s.name === u.school);
                    const region = schoolMeta?.region || '미지정';
                    return selectedRegion === 'ALL' || region === selectedRegion;
                });

                Object.values(studentMap).forEach(studentData => {
                    const user = users.find(u => u.id === studentData.student_id);
                    if (!user || !user.is_leader) return; // Ignore if user not found or not a leader

                    // Apply region filter if not 'ALL'
                    const schoolMeta = schools.find(s => s.name === user.school);
                    const region = schoolMeta?.region || '미지정';

                    if (selectedRegion !== 'ALL' && region !== selectedRegion) return;

                    // Get facilitator name from the latest log
                    let facilitatorNames = [];
                    if (studentData.latestLog?.facilitator_ids?.length > 0) {
                        studentData.latestLog.facilitator_ids.forEach(fid => {
                            const staff = users.find(u => u.id === fid);
                            if (staff) facilitatorNames.push(staff.name);
                        });
                    }

                    const progressObj = {
                        user,
                        schoolName: user.school || '소속 없음',
                        region: region,
                        completedCount: studentData.completedWeeks.length,
                        latestWeek: studentData.latestWeekIndex,
                        facilitatorStr: facilitatorNames.length > 0 ? facilitatorNames.join(', ') : '지정되지 않음'
                    };

                    if (studentData.completedWeeks.length >= 6) {
                        comp.push(progressObj);
                    } else if (studentData.completedWeeks.length > 0) {
                        inProg.push(progressObj);
                    }
                });

                // Sort by name
                comp.sort((a, b) => a.user.name.localeCompare(b.user.name));
                // Sort by latest week descending, then name
                inProg.sort((a, b) => {
                    if (b.latestWeek !== a.latestWeek) return b.latestWeek - a.latestWeek;
                    return a.user.name.localeCompare(b.user.name);
                });

                setCompleters(comp);
                setInProgress(inProg);
                setTotalLeaders(allLeadersInRegion.length);
            } catch (err) {
                console.error("Error fetching dashboard data:", err);
                alert("데이터를 불러오는 중 오류가 발생했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [users, selectedRegion, schools]);

    const [totalLeaders, setTotalLeaders] = useState(0);

    if (loading) {
        return (
            <div className="bg-white rounded-3xl p-10 flex flex-col items-center justify-center border border-gray-100 shadow-sm min-h-[400px]">
                <div className="w-12 h-12 border-4 border-green-200 border-t-green-500 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400 font-bold animate-pulse">콜링포레스트 진행 데이터를 분석하고 있습니다...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            {/* Header info & Stats Summary */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-1 bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-green-500 text-white flex items-center justify-center shadow-md shrink-0">
                        <Flame size={24} className="fill-current" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-gray-800">리더훈련</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">콜링포레스트 진행 현황</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 xl:col-span-3">
                    <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">총 리더 인원</p>
                        <p className="text-2xl font-black text-gray-800">{totalLeaders}<span className="text-xs font-bold ml-1 opacity-40">명</span></p>
                    </div>
                    <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">훈련중 리더</p>
                        <p className="text-2xl font-black text-indigo-600">{inProgress.length}<span className="text-xs font-bold ml-1 opacity-40">명</span></p>
                    </div>
                    <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">수료한 리더</p>
                        <p className="text-2xl font-black text-green-600">{completers.length}<span className="text-xs font-bold ml-1 opacity-40">명</span></p>
                    </div>
                </div>
            </div>

            {/* In Progress Students (TOP) */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center">
                            <Clock size={16} />
                        </div>
                        <h3 className="text-xl font-black text-gray-800">훈련 진행 중</h3>
                    </div>
                    <span className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-black">
                        {inProgress.length}명
                    </span>
                </div>

                <div className="p-6">
                    {inProgress.length > 0 ? (
                        <div className={`
                            ${viewMode === 'list' ? 'flex flex-col gap-2' : 'grid gap-4'}
                            ${viewMode === 'grid-lg' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : ''}
                            ${viewMode === 'grid-md' ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : ''}
                            ${viewMode === 'grid-sm' ? 'grid-cols-3 md:grid-cols-4 xl:grid-cols-5' : ''}
                        `}>
                            {inProgress.map((p, i) => (
                                <ProgressBarCard key={i} p={p} viewMode={viewMode} />
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center text-gray-300 font-bold">
                            <Clock size={48} className="mb-4 opacity-20" />
                            <p>현재 훈련을 진행 중인 학생이 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Completers (BOTTOM) */}
            <div className="bg-green-50/30 rounded-3xl border border-green-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-green-100/50 flex items-center justify-between bg-green-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-green-500 text-white flex items-center justify-center">
                            <Star size={16} className="fill-current" />
                        </div>
                        <h3 className="text-xl font-black text-green-800">훈련 수료자</h3>
                    </div>
                    <span className="px-4 py-1.5 bg-green-200 text-green-800 rounded-full text-sm font-black">
                        {completers.length}명
                    </span>
                </div>

                <div className="p-6">
                    {completers.length > 0 ? (
                        <div className={`
                            ${viewMode === 'list' ? 'flex flex-col gap-2' : 'grid gap-4'}
                            ${viewMode === 'grid-lg' ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : ''}
                            ${viewMode === 'grid-md' ? 'grid-cols-3 md:grid-cols-4 xl:grid-cols-5' : ''}
                            ${viewMode === 'grid-sm' ? 'grid-cols-4 md:grid-cols-5 xl:grid-cols-6' : ''}
                        `}>
                            {completers.map((c, i) => (
                                <CompleterCard key={i} c={c} viewMode={viewMode} />
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center text-gray-300 font-bold">
                            <Star size={48} className="mb-4 opacity-20" />
                            <p>아직 훈련을 수료한 학생이 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CallingForestDashboard;