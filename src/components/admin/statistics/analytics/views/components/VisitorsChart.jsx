import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316'];

const VisitorsChart = ({ spaceData, setSelectedRoomDetails }) => {
    const totalVisitors = spaceData.roomAnalysis.reduce((acc, r) => acc + r.uniqueUsers, 0);

    const roomSplits = spaceData.roomAnalysis.map(r => {
        const students = r.userDetails?.filter(u => u.group !== '졸업생' && u.group !== '일반인' && u.group !== '게스트').length || 0;
        const graduates = r.userDetails?.filter(u => u.group === '졸업생' || u.group === '일반인').length || 0;
        return { students, graduates };
    });

    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, index, value }) => {
        if (value === 0) return null;
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        const pct = totalVisitors > 0 ? Math.round(value / totalVisitors * 100) : 0;
        if (pct < 8) return null;
        return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" style={{ fontSize: '11px', fontWeight: 900 }}>
                {value}
            </text>
        );
    };

    return (
        <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-base md:text-lg font-black text-gray-800">공간별 방문자 수</h3>
                <span className="text-xl md:text-2xl font-black text-blue-600">{totalVisitors}<span className="text-xs font-bold text-gray-400 ml-0.5">명</span></span>
            </div>

            <div className="flex items-center gap-4">
                {/* Donut */}
                <div className="w-36 h-36 md:w-44 md:h-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={spaceData.roomAnalysis}
                                dataKey="uniqueUsers"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius="50%"
                                outerRadius="90%"
                                paddingAngle={2}
                                onClick={(data) => setSelectedRoomDetails(data)}
                                className="cursor-pointer"
                                stroke="none"
                                label={renderCustomLabel}
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
                        const split = roomSplits[i];
                        const pct = totalVisitors > 0 ? Math.round(r.uniqueUsers / totalVisitors * 100) : 0;
                        return (
                            <button
                                key={r.name}
                                onClick={() => setSelectedRoomDetails(r)}
                                className="w-full text-left p-2.5 md:p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                    <span className="text-sm md:text-base font-black text-gray-800 truncate">{r.name}</span>
                                    <span className="ml-auto text-sm md:text-base font-black shrink-0" style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>{r.uniqueUsers}명</span>
                                    <span className="text-[10px] font-bold text-gray-400 shrink-0">{pct}%</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                        {split.students > 0 && (
                                            <div className="h-full bg-blue-400 rounded-l-full" style={{ width: `${(r.uniqueUsers > 0 ? (split.students / r.uniqueUsers) * 100 : 0)}%` }} />
                                        )}
                                        {split.graduates > 0 && (
                                            <div className="h-full bg-orange-400 rounded-r-full" style={{ width: `${(r.uniqueUsers > 0 ? (split.graduates / r.uniqueUsers) * 100 : 0)}%` }} />
                                        )}
                                    </div>
                                    <div className="flex gap-1.5 text-[9px] font-bold shrink-0">
                                        <span className="text-blue-500">재 {split.students}</span>
                                        <span className="text-orange-500">졸 {split.graduates}</span>
                                        {r.guestCount > 0 && <span className="text-gray-400">손 {r.guestCount}</span>}
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

export default VisitorsChart;
