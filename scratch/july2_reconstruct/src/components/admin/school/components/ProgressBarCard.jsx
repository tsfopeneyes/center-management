import React from 'react';
import { User } from 'lucide-react';
import { calculateAge } from '../../../../utils/dateUtils';

const ProgressBarCard = ({ p, viewMode }) => {
    const isList = viewMode === 'list';
    const isSmall = viewMode === 'grid-sm';
    const isMedium = viewMode === 'grid-md';
    const isLarge = !isList && !isSmall && !isMedium;

    if (isList) {
        return (
            <div className="bg-white rounded-xl p-2.5 border border-gray-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className="font-black text-gray-800 text-sm truncate">{p.user.name}</div>
                            <div className="text-[10px] font-bold text-gray-400">({calculateAge(p.user.birth)})</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] font-black px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-md truncate max-w-[80px]">{p.schoolName}</span>
                        </div>
                        <div className="hidden md:flex items-center gap-1.5 text-gray-400 shrink-0">
                            <User size={10} />
                            <span className="text-[10px] font-bold truncate max-w-[100px]">{p.facilitatorStr}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md">{p.latestWeek}주</span>
                        <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5, 6].map(step => (
                                <div
                                    key={step}
                                    className={`w-1 h-1 rounded-full ${step <= p.completedCount ? 'bg-green-500' : 'bg-gray-100'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col ${isSmall ? 'p-2.5 px-3' : isMedium ? 'p-3.5' : 'p-4 md:p-5'}`}>
            <div className={`flex items-center ${isSmall ? 'mb-0 gap-2 justify-between' : isLarge ? 'mb-4 gap-4' : 'mb-3 gap-3'}`}>
                {!isSmall && (
                    <div className={`${isMedium ? 'w-10 h-10 text-sm' : 'w-14 h-14 text-xl'} rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shadow-inner shrink-0`}>
                        {p.user.name.charAt(0)}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <div className={`flex items-center gap-1.5 ${isSmall ? 'w-full justify-between' : ''}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                            <div className={`font-black text-gray-800 truncate ${isSmall ? 'text-sm' : isLarge ? 'text-xl' : 'text-base'}`}>{p.user.name}</div>
                            {!isSmall && (
                                <div className={`font-bold text-gray-400 ${isLarge ? 'text-lg' : 'text-xs'}`}>({calculateAge(p.user.birth)})</div>
                            )}
                        </div>

                        {isSmall && (
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold text-gray-300">/</span>
                                <span className="text-[11px] font-black text-green-600 bg-green-50/50 px-1.5 py-0.5 rounded-md">{p.latestWeek}주</span>
                            </div>
                        )}
                    </div>
                    {!isSmall && (
                        <div className={`flex items-center gap-1 ${isLarge ? 'mt-1' : 'mt-0.5'}`}>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded-md truncate ${isLarge ? 'text-[10px] max-w-[120px]' : 'max-w-[80px]'}`}>{p.schoolName}</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 bg-indigo-50 text-indigo-400 rounded-md ${isLarge ? 'text-[10px]' : ''}`}>{p.region}</span>
                        </div>
                    )}
                </div>
            </div>

            {!isSmall && (
                <div className={`pt-3 border-t border-gray-50 flex items-center justify-between mt-auto ${isLarge ? 'pt-4' : ''}`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <User size={12} className="text-gray-300 shrink-0" />
                        <span className={`font-bold truncate max-w-[150px] ${isLarge ? 'text-sm text-gray-600' : 'text-[10px] text-gray-400 '}`}>
                            {isLarge ? '' : '진행자: '}<span className={isLarge ? 'font-black' : ''}>{p.facilitatorStr}</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                        <span className={`font-black text-green-600 bg-green-50 rounded-md shrink-0 ${isLarge ? 'text-sm px-2.5 py-1' : 'text-[10px] px-1.5 py-0.5'}`}>{p.latestWeek}주</span>
                        <div className={`flex ${isLarge ? 'gap-1.5' : 'gap-1'}`}>
                            {[1, 2, 3, 4, 5, 6].map(step => (
                                <div
                                    key={step}
                                    className={`${isLarge ? 'w-2 h-2' : 'w-1 h-1'} rounded-full ${step <= p.completedCount ? 'bg-green-500' : 'bg-gray-100'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgressBarCard;
