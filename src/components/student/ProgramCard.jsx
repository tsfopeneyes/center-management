import React from 'react';
import { stripHtml } from '../../utils/textUtils';
import { parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { MapPin, Calendar, Clock, ChevronRight } from 'lucide-react';

const ProgramCard = ({ program, onClick }) => {
    const thumb = program.image_url || (program.images?.length > 0 ? program.images[0] : null);

    // Check for "Closing Soon" (within 24 hours of recruitment_deadline)
    const isClosingSoon = (() => {
        if (!program.recruitment_deadline || !program.is_recruiting) return false;
        const deadline = parseISO(program.recruitment_deadline);
        const now = new Date();
        const diff = deadline - now;
        const oneDay = 24 * 60 * 60 * 1000;
        return diff > 0 && diff < oneDay;
    })();

    return (
        <div
            onClick={() => onClick(program)}
            className="group relative bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 active:scale-[0.97] cursor-pointer"
        >
            {/* Thumbnail Section (16:9) */}
            <div className="relative aspect-video overflow-hidden bg-gray-100">
                {thumb ? (
                    <img
                        src={thumb}
                        alt={program.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-200">
                        <Calendar size={48} />
                    </div>
                )}

                {/* Status Badges Overlaid */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                    {program.is_recruiting && (
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/90 backdrop-blur-md text-white rounded-full text-[10px] font-bold shadow-lg">
                            <Clock size={12} /> 모집중
                        </div>
                    )}
                    {isClosingSoon && (
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-full text-[10px] font-bold shadow-lg animate-pulse">
                            🔥 마감임박
                        </div>
                    )}
                </div>

                {/* Location Overlay Pill (Bottom Right) */}
                {program.program_location && (
                    <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-md text-white rounded-xl text-[10px] font-bold flex items-center gap-1.5 border border-white/20">
                        <MapPin size={12} className="text-blue-300" />
                        {program.program_location}
                    </div>
                )}

                {/* Gradient Overlay for better contrast on text if needed */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>

            {/* Content Section */}
            <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="flex-1 font-extrabold text-gray-800 text-lg leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {program.title}
                    </h3>
                </div>

                <p className="text-gray-500 text-xs line-clamp-2 mb-4 leading-relaxed">
                    {stripHtml(program.content)}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                            <Calendar size={12} />
                            {program.program_date ? new Date(program.program_date).toLocaleDateString() : '일정 미정'}
                        </div>
                        {program.program_duration && (
                            <span className="text-[11px] text-gray-400 font-medium">
                                {program.program_duration}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center text-gray-300 group-hover:text-blue-500 transition-colors">
                        <span className="text-[10px] font-bold mr-1">상세보기</span>
                        <ChevronRight size={14} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProgramCard;
