import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

const START_SCHEMA = [
    {
        floor: '2층',
        items: [
            { category: '조명', label: '2층 천정/디밍 ON' },
            { category: '조명', label: '소회의실 1, 2 ON' },
            { category: '조명', label: '화장실/복도 조명 ON' },
            { category: '에어컨', label: '에어컨/환풍기 ON' },
            { category: '기타', label: '입구 간판 ON' },
        ]
    },
    {
        floor: '3층',
        items: [
            { category: '조명', label: '3층 천정 ON' },
            { category: '조명', label: '3층 디밍 ON' },
            { category: '조명', label: '화장실/복도 조명 ON' },
            { category: '에어컨', label: '에어컨 ON' },
            { category: '에어컨', label: '환풍기 ON' },
            { category: '창문', label: '창문 확인' },
        ]
    },
    {
        floor: '6층',
        items: [
            { category: '조명', label: '라운지 천정 ON' },
            { category: '조명', label: '라운지 스탠드전등 ON' },
            { category: '조명', label: '복도 조명 ON' },
            { category: '에어컨', label: '에어컨 ON (날씨에 따라)' },
            { category: '기타', label: '말린음쓰 음쓰봉투 비우기' },
            { category: '창문', label: '창문 확인' },
        ]
    }
];

const END_SCHEMA = [
    {
        floor: '1층 / 지하',
        items: [
            { category: '조명', label: '1층/지하 복도 및 조명 OFF' },
            { category: '에어컨', label: '지하 에어컨/환풍기 OFF' },
            { category: '기타', label: '지하 전자기기 OFF' },
            { category: '보안', label: '1층 보안 잠금 확인' },
        ]
    },
    {
        floor: '2층',
        items: [
            { category: '조명', label: '2층 전체 조명/소회의실 OFF' },
            { category: '에어컨', label: '에어컨/환풍기 OFF' },
            { category: '기타', label: '입장QR 태블릿 OFF' },
            { category: '창문', label: '창문 닫힘 확인' },
        ]
    },
    {
        floor: '3층',
        items: [
            { category: '조명', label: '3층 전체 조명/화장실 OFF' },
            { category: '에어컨', label: '에어컨/환풍기 OFF' },
            { category: '창문', label: '창문 닫힘 확인' },
        ]
    },
    {
        floor: '4층',
        items: [
            { category: '조명', label: '커넥트룸 1~3 OFF' },
            { category: '조명', label: '화장실/복도 조명 OFF' },
            { category: '에어컨', label: '에어컨/환풍기 OFF' },
            { category: '창문', label: '창문 닫힘 확인' },
        ]
    },
    {
        floor: '5층',
        items: [
            { category: '조명', label: '사무실/회의실/대표님실 OFF' },
            { category: '조명', label: '화장실/복도 조명 OFF' },
            { category: '에어컨', label: '에어컨/환풍기 OFF' },
            { category: '창문', label: '창문 닫힘 확인' },
        ]
    },
    {
        floor: '6층',
        items: [
            { category: '조명', label: '라운지/복도/화장실 OFF' },
            { category: '에어컨', label: '에어컨/환풍기 OFF' },
            { category: '기타', label: '분리수거 확인 (아이들 주도)' },
            { category: '창문', label: '창문 닫힘 확인' },
            { category: '기타', label: '음식물 처리' },
        ]
    }
];

const DutyChecklist = ({ type, data, checklistSettings = [], onSave }) => {
    const [localData, setLocalData] = useState(data || {});

    // Generate dynamic schema based on dbSettings, fallback to static schema if empty
    const getDynamicSchema = () => {
        const typeSettings = checklistSettings.filter(item => item.type === type);
        if (typeSettings.length === 0) {
            // Fallback to static schema
            const staticSchema = type === 'START' ? START_SCHEMA : END_SCHEMA;
            return staticSchema.map(group => ({
                ...group,
                items: group.items.map(item => ({
                    ...item,
                    id: `${group.floor}-${item.label}` // Unique key for static fallback
                }))
            }));
        }

        // Group db settings by floor
        const groups = {};
        typeSettings.forEach(item => {
            if (!groups[item.floor]) {
                groups[item.floor] = [];
            }
            groups[item.floor].push(item);
        });

        // Explicit floor sorting order (bottom to top)
        const floorOrder = ['1층 / 기타', '1층/기타', '1층 / 지하', '지하 1층', '지하', '1층', '2층', '3층', '4층', '5층', '6층', '옥상'];

        return Object.keys(groups)
            .sort((a, b) => {
                const indexA = floorOrder.indexOf(a);
                const indexB = floorOrder.indexOf(b);
                
                // If both are found in the predefined order, sort by their index
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                // If only one is found, prioritize it
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                // If neither is found, fallback to alphabetical
                return a.localeCompare(b);
            })
            .map(floor => ({
                floor,
                items: groups[floor].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            }));
    };

    const schema = getDynamicSchema();

    useEffect(() => {
        setLocalData(data || {});
    }, [data]);

    const toggleItem = (itemId) => {
        const newValue = !localData[itemId];
        const newData = { ...localData, [itemId]: newValue };
        setLocalData(newData);
        onSave(newData); // Auto save on toggle
    };

    const handleCheckAll = (group) => {
        const newData = { ...localData };
        let allChecked = true;
        
        group.items.forEach(item => {
            if (!newData[item.id]) {
                allChecked = false;
            }
        });

        group.items.forEach(item => {
            newData[item.id] = !allChecked;
        });

        setLocalData(newData);
        onSave(newData);
    };

    const getProgress = () => {
        let total = 0;
        let checked = 0;
        schema.forEach(group => {
            group.items.forEach(item => {
                total++;
                if (localData[item.id]) checked++;
            });
        });
        return { checked, total, percent: total === 0 ? 0 : Math.round((checked / total) * 100) };
    };

    const progress = getProgress();

    return (
        <div className="space-y-6 pb-2 md:pb-6 relative h-full flex flex-col">
            {/* Checklist items */}
            <div className="space-y-4 md:space-y-6 flex-1">
                {schema.map((group, fIdx) => (
                    <div key={fIdx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-black text-gray-800 text-lg">{group.floor}</h3>
                            <button 
                                onClick={() => handleCheckAll(group)}
                                className="px-3 py-1.5 bg-blue-100 text-blue-600 font-bold text-sm rounded-lg hover:bg-blue-200 transition-colors"
                            >
                                모두 확인
                            </button>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {group.items.map((item) => {
                                const isChecked = !!localData[item.id];
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => toggleItem(item.id)}
                                        className="w-full flex items-center gap-4 p-4 hover:bg-blue-50/50 transition-colors text-left"
                                    >
                                        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isChecked ? 'text-blue-500' : 'text-gray-300'}`}>
                                            {isChecked ? <CheckCircle2 size={28} className="drop-shadow-sm" /> : <Circle size={28} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-gray-400 mb-0.5">{item.category}</div>
                                            <div className={`font-bold truncate transition-colors ${isChecked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                                {item.label}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Progress Bar (Sticky) */}
            <div className="sticky bottom-4 md:bottom-6 w-full bg-white/95 backdrop-blur-md p-4 md:p-5 rounded-2xl shadow-[0_8px_30px_-5px_rgba(0,0,0,0.2)] border border-gray-200/80 z-20 mt-8 mx-auto" style={{ transform: 'translateZ(0)' }}>
                <div className="flex items-center justify-between gap-4 md:gap-6">
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-xs md:text-sm font-bold text-gray-600">진행률</span>
                            <span className="text-lg md:text-xl font-black text-blue-600">{progress.percent}%</span>
                        </div>
                        <div className="h-2.5 md:h-3 bg-gray-100/80 rounded-full overflow-hidden ring-1 ring-inset ring-gray-200/50">
                            <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progress.percent}%` }}
                            />
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0 min-w-[60px] md:min-w-[80px]">
                        <div className="text-[10px] md:text-xs text-gray-400 font-bold mb-1">완료 항목</div>
                        <div className="text-base md:text-lg font-black text-gray-800 flex items-baseline justify-end gap-1">
                            {progress.checked} <span className="text-gray-400 text-xs md:text-sm">/ {progress.total}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default DutyChecklist;
