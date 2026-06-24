import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Target } from 'lucide-react';

const COLORS = {
    '개인 할 일': '#3b82f6',     // Blue text-blue-600
    '프로그램 참여': '#4f46e5',  // Indigo text-indigo-600
    '교제 및 휴식': '#f97316',  // Orange text-orange-600
    '스처쌤 만남': '#e11d48',    // Rose text-rose-600
    '미선택': '#94a3b8'         // Slate text-slate-400
};

// Colors for locations splitting within the progress bar
const LOC_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316'];

const SpacePurposeChart = ({ spaceData }) => {
    if (!spaceData || !spaceData.roomAnalysis) return null;

    const purposeCategories = ['개인 할 일', '프로그램 참여', '교제 및 휴식', '스처쌤 만남', '미선택'];

    // Map data: Aggregate by Purpose Category
    const totalByPurpose = purposeCategories.map(cat => {
        let count = 0;
        const locBreakdown = [];
        spaceData.roomAnalysis.forEach(loc => {
            if (!loc.purposeCounts) return;
            const c = loc.purposeCounts[cat] || 0;
            count += c;
            if (c > 0) locBreakdown.push({ name: loc.name, count: c });
        });
        return { name: cat, count, locBreakdown };
    }).filter(p => p.count > 0).sort((a, b) => b.count - a.count);

    const totalActivities = totalByPurpose.reduce((acc, p) => acc + p.count, 0);

    if (totalActivities === 0) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-64 flex flex-col items-center justify-center">
                <Target className="text-gray-300 mb-2" size={32} />
                <p className="text-gray-500 font-medium">활동 내역 데이터가 없습니다.</p>
            </div>
        );
    }

    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, index, value }) => {
        if (value === 0) return null;
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        const pct = totalActivities > 0 ? Math.round(value / totalActivities * 100) : 0;
        if (pct < 8) return null;
        return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" style={{ fontSize: '11px', fontWeight: 900 }}>
                {value}
            </text>
        );
    };

    return (
        <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-100 h-full">
            <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-base md:text-lg font-black text-gray-800">공간별 활동 내역</h3>
                <span className="text-xl md:text-2xl font-black text-indigo-500">{totalActivities}<span className="text-xs font-bold text-gray-400 ml-0.5">건</span></span>
            </div>

            <div className="flex items-center gap-4">
                {/* Donut */}
                <div className="w-36 h-36 md:w-44 md:h-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={totalByPurpose}
                                dataKey="count"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius="50%"
                                outerRadius="90%"
                                paddingAngle={2}
                                stroke="none"
                                label={renderCustomLabel}
                                labelLine={false}
                            >
                                {totalByPurpose.map((entry, i) => (
                                    <Cell key={i} fill={COLORS[entry.name] || '#94a3b8'} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Detail Cards */}
                <div className="flex-1 space-y-2 min-w-0 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {totalByPurpose.map((p, i) => {
                        const pct = totalActivities > 0 ? Math.round(p.count / totalActivities * 100) : 0;
                        const fillCol = COLORS[p.name] || '#94a3b8';
                        return (
                            <div
                                key={p.name}
                                className="w-full text-left p-2.5 md:p-3 rounded-xl border border-gray-100 hover:border-indigo-100 transition-all group"
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: fillCol }} />
                                    <span className="text-sm md:text-base font-black text-gray-800 truncate">{p.name}</span>
                                    <span className="ml-auto text-sm md:text-base font-black shrink-0" style={{ color: fillCol }}>{p.count}건</span>
                                    <span className="text-[10px] font-bold text-gray-400 shrink-0">{pct}%</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                        {p.locBreakdown.map((loc, j) => (
                                            <div 
                                                key={loc.name} 
                                                className="h-full" 
                                                style={{ 
                                                    width: `${(p.count > 0 ? (loc.count / p.count) * 100 : 0)}%`,
                                                    backgroundColor: LOC_COLORS[j % LOC_COLORS.length]
                                                }} 
                                            />
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 text-[9px] font-bold">
                                        {p.locBreakdown.map((loc, j) => (
                                            <span key={loc.name} style={{ color: LOC_COLORS[j % LOC_COLORS.length] }}>
                                                {loc.name.substring(0, 3)} {loc.count}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SpacePurposeChart;
