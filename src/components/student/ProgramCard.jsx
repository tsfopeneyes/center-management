import React from 'react';
import { stripHtml } from '../../utils/textUtils';
import { parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { MapPin, Calendar, Clock, ChevronRight, Users, CheckCircle2 } from 'lucide-react';

const ProgramCard = ({ program, onClick, compact = false }) => {
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

    const formatDate = (dateString) => {
        if (!dateString) return '일정 미정';
        const date = new Date(dateString);
        
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dayOfWeek = days[date.getDay()];
        
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? '오후' : '오전';
        
        hours = hours % 12;
        hours = hours ? hours : 12;
        
        const minuteStr = minutes > 0 ? ` ${minutes}분` : '';
        return `${month}/${day}(${dayOfWeek}) ${ampm} ${hours}시${minuteStr}`;
    };

    const isPast = program.program_date && new Date(program.program_date) < startOfDay(new Date());

    return (
        <div
            onClick={() => onClick(program)}
            className={`group bg-white overflow-hidden shadow-sm hover:shadow-lg border border-gray-100 transition-all duration-300 active:scale-[0.98] cursor-pointer flex flex-col h-full transform-gpu isolate ring-1 ring-black/5 ${compact ? 'rounded-[1.5rem]' : 'rounded-[2.5rem]'}`}
        >
            {/* Thumbnail Section */}
            <div className={`relative aspect-square overflow-hidden bg-gray-50 border-b border-gray-100/50 transform-gpu backface-hidden`}>
                {thumb ? (
                    <img
                        src={thumb}
                        alt={program.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 will-change-transform transform-gpu"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50/50 text-blue-200">
                        <Calendar size={compact ? 32 : 48} />
                    </div>
                )}

                {/* Status Badges Overlaid */}
                <div className={`absolute flex flex-col items-start ${compact ? 'top-2.5 left-2.5 gap-1.5' : 'top-4 left-4 gap-2'}`}>
                    {program.is_recruiting && !isClosingSoon && !isPast && (
                        <div className={`flex items-center bg-blue-500 text-white font-black shadow-md uppercase tracking-wider ${compact ? 'gap-1 px-2.5 py-1 rounded-full text-[9px]' : 'gap-1.5 px-3 py-1.5 rounded-full text-[10px]'}`}>
                            <Clock size={compact ? 10 : 12} strokeWidth={3} /> 모집중
                        </div>
                    )}
                    {isClosingSoon && !isPast && (
                        <div className={`flex items-center bg-gray-700 text-white font-black shadow-md uppercase tracking-wider ${compact ? 'gap-1 px-2.5 py-1 rounded-full text-[9px]' : 'gap-1.5 px-3 py-1.5 rounded-full text-[10px]'}`}>
                            <CheckCircle2 size={compact ? 10 : 12} strokeWidth={3} /> 마감임박
                        </div>
                    )}
                    {program.is_leader_only && (
                        <div className={`flex items-center bg-yellow-400 text-yellow-900 font-black shadow-md border border-yellow-500/20 w-fit ${compact ? 'gap-1 px-2 py-1 rounded-full text-[9px]' : 'gap-1.5 px-3 py-1.5 rounded-full text-[10px]'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width={compact ? "10" : "12"} height={compact ? "10" : "12"} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                            리더전용
                        </div>
                    )}
                </div>
            </div>

            {/* Content Section */}
            <div className={compact ? "p-4 flex flex-col flex-1" : "p-6 pb-4"}>
                <h3 className={`font-extrabold text-gray-900 line-clamp-2 ${compact ? 'text-sm leading-snug ' + (program.short_description ? 'mb-1' : 'mb-3') : 'text-xl leading-tight ' + (program.short_description ? 'mb-2' : 'mb-4')}`}>
                    {program.title}
                </h3>
                
                {program.short_description && (
                    <p className={`text-gray-500 font-bold break-keep whitespace-normal ${compact ? 'text-[11px] mb-3 leading-snug' : 'text-[15px] mb-6 leading-relaxed'}`}>
                        {program.short_description}
                    </p>
                )}

                <div className={compact ? "space-y-1.5 mb-3 flex-1" : "space-y-3 mb-6"}>
                    <div className={`flex items-center text-gray-400 ${compact ? 'gap-2' : 'gap-3'}`}>
                        <Calendar size={compact ? 14 : 18} className="shrink-0 text-gray-300" />
                        <span className={`font-bold text-gray-600 ${compact ? 'text-[11px] line-clamp-1' : 'text-sm'}`}>{formatDate(program.program_date)}</span>
                    </div>
                    {program.program_duration && !compact && (
                        <div className={`flex items-center text-gray-400 ${compact ? 'gap-2 mt-1' : 'gap-3'}`}>
                            <Clock size={compact ? 14 : 18} className="shrink-0 text-gray-300" />
                            <span className={`font-bold text-gray-600 ${compact ? 'text-[11px] line-clamp-1' : 'text-sm'}`}>소요시간: {program.program_duration}</span>
                        </div>
                    )}
                    {program.program_location && (
                        <div className={`flex items-center text-gray-400 ${compact ? 'gap-2 mt-1' : 'gap-3'}`}>
                            <MapPin size={compact ? 14 : 18} className="shrink-0 text-gray-300" />
                            <span className={`font-bold text-gray-600 ${compact ? 'text-[11px] line-clamp-1' : 'text-sm'}`}>{program.program_location}</span>
                        </div>
                    )}
                    <div className={`flex items-center text-gray-400 ${compact ? 'gap-2 mt-1' : 'gap-3'}`}>
                        <Users size={compact ? 14 : 18} className="shrink-0 text-gray-300" />
                        <div className={`font-bold flex items-center gap-[3px] ${compact ? 'text-[11px]' : 'text-sm'}`}>
                            <span className="text-gray-600">모집: </span>
                            <span className="text-blue-500 font-extrabold tracking-tight">
                                {program.current_applicants || 0}
                            </span>
                            <span className="text-gray-400 font-semibold tracking-tight">
                                {program.max_capacity > 0 ? `/ ${program.max_capacity}명` : '명 (제한 없음)'}
                            </span>
                        </div>
                    </div>
                </div>

                <button className={`w-full font-black transition-colors active:scale-95 shadow-sm border border-transparent ${compact ? 'py-2.5 rounded-xl text-xs mt-auto' : 'py-4 rounded-full text-base shadow-lg mt-auto'} ${program.responseStatus === 'JOIN' ? 'bg-gray-50 border-gray-100 text-gray-400' : (program.responseStatus === 'WAITLIST' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-600 text-white shadow-blue-200/50 hover:bg-blue-700')}`}>
                    {program.responseStatus === 'JOIN' ? '신청 완료' : (program.responseStatus === 'WAITLIST' ? '대기명단' : '신청하기')}
                </button>
            </div>
        </div>
    );
};

export default React.memo(ProgramCard, (prevProps, nextProps) => {
    return prevProps.program.id === nextProps.program.id &&
        prevProps.program.responseStatus === nextProps.program.responseStatus &&
        prevProps.program.current_applicants === nextProps.program.current_applicants;
});
