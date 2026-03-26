import React, { useState } from 'react';
import { LineChart, LayoutGrid } from 'lucide-react';

// Chart Components
import VisitorsChart from './components/VisitorsChart';
import DurationChart from './components/DurationChart';
import TrendChart from './components/TrendChart';
import HeatmapChart from './components/HeatmapChart';

const SpaceAnalyticsView = ({ hookData }) => {
    const { 
        periodType, 
        setSelectedRoomDetails, 
        spaceData 
    } = hookData;

    const [showTrend, setShowTrend] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(false);

    if (!hookData || !spaceData) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <VisitorsChart 
                spaceData={spaceData} 
                setSelectedRoomDetails={setSelectedRoomDetails} 
            />
            
            <DurationChart 
                spaceData={spaceData} 
                setSelectedRoomDetails={setSelectedRoomDetails} 
            />

            {(!showTrend || !showHeatmap) && (
                <div className="md:col-span-2 flex flex-col md:flex-row justify-center items-center gap-3 py-4">
                    {!showTrend && (
                        <button 
                            onClick={() => setShowTrend(true)} 
                            className="w-full md:w-auto px-6 py-3 bg-white border border-blue-100 rounded-xl text-blue-600 font-bold shadow-sm hover:shadow-md hover:bg-blue-50 transition flex items-center justify-center gap-2"
                        >
                            <LineChart size={18} /> 일별 이용 추이 불러오기
                        </button>
                    )}
                    
                    {!showHeatmap && (
                        <button 
                            onClick={() => setShowHeatmap(true)} 
                            className="w-full md:w-auto px-6 py-3 bg-white border border-purple-100 rounded-xl text-purple-600 font-bold shadow-sm hover:shadow-md hover:bg-purple-50 transition flex items-center justify-center gap-2"
                        >
                            <LayoutGrid size={18} /> 요일 및 시간대별 방문 혼잡도 불러오기
                        </button>
                    )}
                </div>
            )}
            
            {showTrend && (
                <TrendChart 
                    spaceData={spaceData} 
                    periodType={periodType} 
                />
            )}

            {showHeatmap && (
                <HeatmapChart 
                    spaceData={spaceData} 
                />
            )}
        </div>
    );
};

export default SpaceAnalyticsView;
