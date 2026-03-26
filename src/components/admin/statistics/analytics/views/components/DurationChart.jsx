import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316'];

const DurationChart = ({ spaceData, setSelectedRoomDetails }) => {
    const totalDuration = spaceData.roomAnalysis.reduce((acc, r) => acc + r.duration, 0);

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
                        const durationHours = (r.duration / 60).toFixed(1);
                        const pct = totalDuration > 0 ? Math.round(r.duration / totalDuration * 100) : 0;
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
                                <div className="flex items-center gap-1.5">
                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                        {studentDuration > 0 && (
                                            <div className="h-full bg-blue-400 rounded-l-full" style={{ width: `${(r.duration > 0 ? (studentDuration / r.duration) * 100 : 0)}%` }} />
                                        )}
                                        {graduateDuration > 0 && (
                                            <div className="h-full bg-orange-400 rounded-r-full" style={{ width: `${(r.duration > 0 ? (graduateDuration / r.duration) * 100 : 0)}%` }} />
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
    );
};

export default DurationChart;
