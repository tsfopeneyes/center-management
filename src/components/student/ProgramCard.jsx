import React from 'react';
import { stripHtml } from '../../utils/textUtils';
import { parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { MapPin, Calendar, Clock, ChevronRight, Users, CheckCircle2 } from 'lucide-react';

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

    const formatDate = (dateString) => {
        if (!dateString) return '일정 미정';
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const isPast = program.program_date && new Date(program.program_date) < startOfDay(new Date());

    return (
        <div
            onClick={() => onClick(program)}
            className="group bg-white rounded-[2.5rem] overflow-hidden shadow-md hover:shadow-xl border border-gray-100 transition-all duration-300 active:scale-[0.98] cursor-pointer flex flex-col"
        >
            {/* Thumbnail Section */}
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
                    {program.is_recruiting && !isClosingSoon && !isPast && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-full text-[10px] font-black shadow-lg">
                            <Clock size={12} strokeWidth={3} /> 모집중
                        </div>
                    )}
                    {isClosingSoon && !isPast && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded-full text-[10px] font-black shadow-lg">
                            <CheckCircle2 size={12} strokeWidth={3} /> 마감임박
                        </div>
                    )}
                    {program.is_leader_only && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 text-yellow-900 rounded-full text-[10px] font-black shadow-lg border border-yellow-500/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                            리더 전용
                        </div>
                    )}
                </div>
            </div>

            {/* Content Section */}
            <div className="p-6 pb-4">
                <h3 className="font-extrabold text-gray-900 text-xl leading-tight mb-4 line-clamp-2">
                    {program.title}
                </h3>

                <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-gray-400">
                        <Calendar size={18} className="shrink-0" />
                        <span className="text-sm font-bold text-gray-600">{formatDate(program.program_date)}</span>
                    </div>
                    {program.program_duration && (
                        <div className="flex items-center gap-3 text-gray-400">
                            <Clock size={18} className="shrink-0" />
                            <span className="text-sm font-bold text-gray-600">소요시간: {program.program_duration}</span>
                        </div>
                    )}
                    {program.program_location && (
                        <div className="flex items-center gap-3 text-gray-400">
                            <MapPin size={18} className="shrink-0" />
                            <span className="text-sm font-bold text-gray-600">{program.program_location}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-3 text-gray-400">
                        <Users size={18} className="shrink-0" />
                        <span className="text-sm font-bold text-gray-600">
                            모집 정원: {program.max_capacity > 0 ? `${program.max_capacity}명` : '제한 없음'}
                        </span>
                    </div>
                </div>

                <div className="mb-6 text-right">
                    <span className="text-[11px] font-bold text-gray-500">
                        현재 신청인원: <span className="text-blue-600">{program.current_applicants || 0}</span>명
                    </span>
                </div>

                <button className={`w-full py-4 rounded-full font-black text-base transition-colors active:scale-95 shadow-lg ${program.responseStatus === 'JOIN' ? 'bg-gray-100 text-gray-400' : (program.responseStatus === 'WAITLIST' ? 'bg-orange-500 text-white shadow-orange-200' : 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700')}`}>
                    {program.responseStatus === 'JOIN' ? '신청 완료' : (program.responseStatus === 'WAITLIST' ? '대기중' : '신청하기')}
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
