import React from 'react';
import { Star } from 'lucide-react';
import { calculateAge } from '../../../../utils/dateUtils';

const CompleterCard = ({ c, viewMode }) => {
    const isList = viewMode === 'list';
    const isSmall = viewMode === 'grid-sm';
    const isMedium = viewMode === 'grid-md';

    if (isList) {
        return (
            <div className="bg-white rounded-xl p-2.5 flex items-center gap-3 border border-green-100/50 shadow-sm group hover:border-green-300 transition-all">
                <div className="flex-1 min-w-0 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="font-black text-gray-800 text-sm truncate">{c.user.name}</div>
                        <div className="text-[10px] font-bold text-gray-400">({calculateAge(c.user.birth)})</div>
                    </div>
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                        <span className="text-[9px] font-black px-1.5 py-0.5 bg-green-50 text-green-600 rounded-md">수료 완료</span>
                        <Star size={14} className="text-green-500 fill-current" />
                    </div>
                </div>
            </div>
        );
    }

    const isLarge = !isSmall && !isMedium;

    return (
        <div className={`bg-white rounded-2xl flex items-center border border-green-100/50 shadow-sm hover:shadow-md transition-all group ${isSmall ? 'p-2.5 gap-2' : isMedium ? 'p-2.5 gap-3' : 'p-3.5 gap-4'}`}>
            {!isSmall && (
                <div className={`${isMedium ? 'w-10 h-10 text-sm' : 'w-14 h-14 text-xl'} rounded-xl bg-green-50 text-green-600 flex items-center justify-center font-black shadow-inner shrink-0`}>
                    {c.user.name.charAt(0)}
                </div>
            )}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <div className={`font-black text-gray-800 truncate ${isSmall ? 'text-sm' : isLarge ? 'text-lg' : ''}`}>{c.user.name}</div>
                    {!isSmall && (
                        <div className={`font-bold text-gray-400 ${isLarge ? 'text-base' : 'text-xs'}`}>({calculateAge(c.user.birth)})</div>
                    )}
                </div>
                {!isSmall && (
                    <div className="text-[10px] font-bold text-gray-400 truncate">{c.schoolName}</div>
                )}
            </div>
            <div className="ml-auto shrink-0">
                <Star size={isSmall ? 12 : 16} className="text-green-500 fill-current" />
            </div>
        </div>
    );
};

export default CompleterCard;
