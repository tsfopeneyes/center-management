import React, { useState } from 'react';
import { Image as ImageIcon, Edit2, Trash2 } from 'lucide-react';

const ChallengeItem = ({ ch, onEdit, onDelete }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <div className="p-4 md:p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors group">
            <div className="flex items-center gap-3 md:gap-4">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center relative flex-shrink-0">
                    {ch.image_url && !imgError ? (
                        <img
                            src={ch.image_url}
                            alt={ch.name}
                            onError={() => setImgError(true)}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <ImageIcon className="text-gray-300" size={20} />
                    )}
                </div>
                <div className="min-w-0">
                    <p className="font-black text-gray-800 text-base md:text-lg truncate">{ch.name}</p>
                    <p className="text-[10px] md:text-xs text-gray-400 font-bold mb-1 truncate max-w-[150px] md:max-w-xs">{ch.description}</p>
                    <div className="flex gap-1.5 md:gap-2 flex-wrap">
                        <span className="text-[9px] md:text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-black uppercase whitespace-nowrap">{ch.type}</span>
                        <span className="text-[9px] md:text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full font-black uppercase whitespace-nowrap">{ch.criteria_label || `${ch.threshold} 기준`}</span>
                    </div>
                </div>
            </div>
            <div className="flex gap-1 md:gap-2 flex-shrink-0 ml-2">
                <button onClick={onEdit} className="p-2 md:p-3 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg md:rounded-xl transition-all"><Edit2 size={16} /></button>
                <button onClick={onDelete} className="p-2 md:p-3 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg md:rounded-xl transition-all"><Trash2 size={16} /></button>
            </div>
        </div>
    );
};

export default ChallengeItem;
