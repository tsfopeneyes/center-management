import React from 'react';
import { motion } from 'framer-motion';
import { Info, Clock, ChevronRight, MapPin } from 'lucide-react';
import { startOfDay, isSameDay } from 'date-fns';
import { CATEGORIES } from '../../constants/appConstants';
import TodayOperatingWidget from './components/TodayOperatingWidget';
import { formatKoreanTimeRange } from '../../utils/dateUtils';

const StudentCalendarTab = ({
    adminSchedules,
    notices,
    calendarCategories,
    openNoticeDetail,
    studentRegion
}) => {
    return (
        <div className="animate-fade-in pb-32 relative min-h-screen">
            <div className="px-5 pt-5 pb-4 sticky top-0 bg-tossGrey50/95 backdrop-blur-xl z-20 border-b border-tossGrey200/50 mb-6">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-bold text-tossGrey900 tracking-tight flex items-center gap-1.5">
                        캘린더
                    </h2>
                    <p className="text-tossGrey500 text-xs font-medium">센터의 전체 일정을 한눈에 확인하세요</p>
                </div>
            </div>

            <div className="px-5">
                <div className="mb-4">
                    <TodayOperatingWidget studentRegion={studentRegion} />
                </div>

            <div className="space-y-2.5">
                {/* Group schedules by date or simple list for now, 
                but a list of upcoming events is often better for mobile */}
                {(() => {
                    const programEvents = [];
                    notices.filter(n => n.category === CATEGORIES.PROGRAM).forEach(n => {
                        if (!n.is_recruiting && n.program_start_date && n.program_end_date && n.program_days && n.program_days.length > 0) {
                            const start = new Date(n.program_start_date);
                            const end = new Date(n.program_end_date);
                            let iter = new Date(start);
                            
                            while (iter <= end) {
                                const dayOfWeek = iter.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
                                if (n.program_days.includes(dayOfWeek)) {
                                    const dateStr = iter.toISOString().split('T')[0];
                                    const timeStr = n.program_date && n.program_date.includes('T') 
                                        ? n.program_date.split('T')[1] 
                                        : '12:00:00';
                                    const programDateStr = `${dateStr}T${timeStr}`;
                                    
                                    programEvents.push({
                                        ...n,
                                        program_date: programDateStr
                                    });
                                }
                                iter.setDate(iter.getDate() + 1);
                            }
                        } else {
                            programEvents.push(n);
                        }
                    });

                    const sortedEvents = [...adminSchedules, ...programEvents]
                        .map(e => {
                            const isProgram = e.category === CATEGORIES.PROGRAM;
                            const cat = calendarCategories.find(c => c.id === e.category_id);
                            let catName = isProgram 
                                ? (e.program_type === 'SCHOOL_CHURCH' ? '스처 프로그램' : '센터 프로그램') 
                                : (e.category_id === 'RENTAL' ? '공간 이용' : cat?.name || '기타');
                            let baseTitle = e.title;

                            if (cat?.name === '휴관') {
                                try {
                                    const parsed = JSON.parse(e.content);
                                    if (parsed && typeof parsed === 'object' && parsed.closed_spaces) {
                                        const spaces = parsed.closed_spaces.map(s => s === 'HYPHEN' ? '하이픈' : '이높').join(', ');
                                        if (spaces) baseTitle = `[${spaces}] ${e.title}`;
                                    }
                                } catch (err) { }
                            }

                             const rawDate = new Date(e.start_date || e.program_date);
                             const isRental = e.category_id === 'RENTAL';
                             
                             let start;
                             let end;
                             
                             if (isProgram) {
                                 start = new Date(e.program_date || e.program_start_date);
                                 end = new Date(e.program_end_date || e.program_start_date || e.program_date);
                             } else if (isRental) {
                                 start = rawDate;
                                 end = new Date(e.end_date || e.start_date);
                             } else {
                                 start = startOfDay(rawDate);
                                 end = startOfDay(new Date(e.end_date || e.start_date));
                             }

                            return {
                                ...e,
                                start,
                                end,
                                title: baseTitle,
                                type: isProgram ? 'PROGRAM' : 'SCHEDULE',
                                catName: catName
                            };
                        })
                        .filter(e => e.end >= startOfDay(new Date()))
                        .filter(e => {
                            // Filter rental bookings: only show if they match current student's region
                            if (e.category_id === 'RENTAL' && e.region && studentRegion) {
                                return e.region === studentRegion;
                            }
                            return true;
                        })
                        .filter(e => {
                            // Hide regular recurring closures (Saturday=6, Sunday=0) to prevent clutter
                            if (e.catName === '휴관') {
                                const day = e.start.getDay();
                                if (day === 0 || day === 6) {
                                    return false;
                                }
                            }
                            return true;
                        })
                        .sort((a, b) => a.start - b.start);

                    if (sortedEvents.length === 0) return <div className="text-center py-20 text-tossGrey400 font-bold">등록된 추가 일정이 없습니다.</div>;

                    return sortedEvents.map((event, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="px-5 py-4 bg-white rounded-2xl border border-gray-100 flex gap-4 items-center group active:scale-[0.98] transition-all text-left shadow-sm hover:shadow-md hover:border-gray-200"
                            onClick={() => event.type === 'PROGRAM' ? openNoticeDetail(event) : null}
                        >
                            {/* Left side: Date Badge */}
                            {(() => {
                                const dayOfWeek = event.start.getDay();
                                const isSame = isSameDay(event.start, event.end);
                                
                                let badgeBg = 'bg-slate-50 border-slate-100/80';
                                let monthColor = 'text-slate-400';
                                let dateColor = 'text-slate-800';
                                let weekdayBg = 'bg-slate-100 text-slate-600';
                                
                                if (dayOfWeek === 0) { // Sunday
                                    badgeBg = 'bg-rose-50/50 border-rose-100/70';
                                    monthColor = 'text-rose-400';
                                    dateColor = 'text-rose-600';
                                    weekdayBg = 'bg-rose-100/80 text-rose-600';
                                } else if (dayOfWeek === 6) { // Saturday
                                    badgeBg = 'bg-blue-50/50 border-blue-100/70';
                                    monthColor = 'text-blue-400';
                                    dateColor = 'text-blue-600';
                                    weekdayBg = 'bg-blue-100/80 text-blue-600';
                                }
                                
                                return (
                                    <div className={`flex flex-col items-center justify-center min-w-[64px] py-2 ${badgeBg} rounded-2xl border text-center shrink-0`}>
                                        <span className={`text-[9px] font-black uppercase tracking-wider ${monthColor} mb-0.5`}>
                                            {event.start.getMonth() + 1}월
                                        </span>
                                        <span className={`text-2xl font-black tracking-tight leading-none mb-1.5 ${dateColor}`}>
                                            {event.start.getDate()}
                                        </span>
                                        {isSame ? (
                                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black ${weekdayBg}`}>
                                                {event.start.toLocaleDateString('ko-KR', { weekday: 'short' })}
                                            </span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[9px] font-black">
                                                ~{event.end.getDate()}일
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Right side: Information block */}
                            <div className="flex-1 min-w-0 py-0.5">
                                <h4 className="font-black text-gray-900 text-[15.5px] tracking-tight leading-snug truncate mb-2 group-hover:text-blue-600 transition-colors">
                                    {event.category_id === 'RENTAL' ? event.meetingName : event.title}
                                </h4>
                                
                                <div className="flex flex-col sm:flex-row sm:items-center gap-y-1 gap-x-3 text-xs font-semibold text-gray-500">
                                    {/* Time Info */}
                                    <span className="flex items-center gap-1.5 text-gray-600">
                                        <Clock size={12} className="text-gray-400 shrink-0" />
                                        <span>
                                            {event.type === 'PROGRAM' ? (
                                                formatKoreanTimeRange(event.program_date || event.program_start_date || event.start, event.program_duration)
                                            ) : event.category_id === 'RENTAL' ? (
                                                `${event.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${event.end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                                            ) : (
                                                new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
                                            )}
                                        </span>
                                    </span>

                                    {/* Location/Space Info */}
                                    {(event.program_location || event.spaceName) && (
                                        <span className="flex items-center gap-1.5 text-blue-600">
                                            <MapPin size={12} className="text-blue-400 shrink-0" />
                                            <span className="truncate max-w-[150px]">{event.category_id === 'RENTAL' ? event.spaceName : event.program_location}</span>
                                            {event.category_id === 'RENTAL' && event.regionName && (
                                                <span className="text-[9px] bg-blue-50 text-blue-600 px-1 py-0.2 rounded font-bold shrink-0">
                                                    {event.regionName}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-600 transition-colors shrink-0" />
                        </motion.div>
                    ));
                })()}
            </div>
            </div>
        </div>
    );
};

export default StudentCalendarTab;
