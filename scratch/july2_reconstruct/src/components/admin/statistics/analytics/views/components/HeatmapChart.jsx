import React from 'react';

const HeatmapChart = ({ spaceData }) => {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2 overflow-x-auto">
            <div className="flex justify-between items-center mb-6 min-w-[700px]">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">요일 및 시간대별 방문 혼잡도</h3>
                    <p className="text-xs font-medium text-gray-400 mt-1">선택한 기간 동안 각 요일/시간대에 발생한 총 체크인 및 방문 횟수</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <span>여유</span>
                    <div className="flex gap-1">
                        <div className="w-4 h-4 rounded bg-gray-50"></div>
                        <div className="w-4 h-4 rounded bg-blue-200"></div>
                        <div className="w-4 h-4 rounded bg-blue-400"></div>
                        <div className="w-4 h-4 rounded bg-blue-600"></div>
                        <div className="w-4 h-4 rounded bg-blue-800"></div>
                    </div>
                    <span>혼잡</span>
                </div>
            </div>
            <div className="min-w-[700px]">
                {/* Header row (Hours: 8 to 23) */}
                <div className="flex mb-2">
                    <div className="w-10 shrink-0"></div>
                    <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                        {Array.from({ length: 16 }).map((_, i) => (
                            <div key={i + 8} className="text-[10px] font-bold text-gray-400 text-center">{i + 8}시</div>
                        ))}
                    </div>
                </div>
                {/* Data rows (Days) */}
                {['일', '월', '화', '수', '목', '금', '토'].map((dayName, dayIdx) => (
                    <div key={dayIdx} className="flex mb-1 items-center">
                        <div className="w-10 shrink-0 text-xs font-bold text-gray-500">{dayName}</div>
                        <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                            {spaceData.heatmapData[dayIdx].slice(8, 24).map((count, i) => {
                                const hourIdx = i + 8;
                                let bgClass = 'bg-gray-50';
                                let textClass = 'text-transparent';
                                if (count > 0) {
                                    const ratio = count / (spaceData.maxHeatmapValue || 1);
                                    if (ratio > 0.8) { bgClass = 'bg-blue-800'; textClass = 'text-white'; }
                                    else if (ratio > 0.5) { bgClass = 'bg-blue-600'; textClass = 'text-white shadow-sm'; }
                                    else if (ratio > 0.2) { bgClass = 'bg-blue-400'; textClass = 'text-white'; }
                                    else { bgClass = 'bg-blue-200'; textClass = 'text-blue-800'; }
                                }
                                return (
                                    <div
                                        key={hourIdx}
                                        className={`h-8 lg:h-10 rounded flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all hover:ring-2 hover:ring-blue-400 hover:scale-105 cursor-pointer ${bgClass} ${textClass}`}
                                        title={`${dayName}요일 ${hourIdx}시: ${count}명 방문`}
                                    >
                                        {count > 0 ? count : ''}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HeatmapChart;
