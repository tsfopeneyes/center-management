import React from 'react';
import { motion } from 'framer-motion';
import { Info, Clock, ChevronRight } from 'lucide-react';
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
                            <div className="flex flex-col items-center justify-center min-w-[70px] py-1 border-r border-tossGrey100 pr-4">
                                <span className="text-[10px] font-extrabold text-tossGrey400 uppercase tracking-wider">{event.start.toLocaleString('ko-KR', { month: 'short' })}</span>
                                <span className="text-lg font-black text-tossGrey800 tracking-tighter mt-0.5">
                                    {isSameDay(event.start, event.end) ? (
                                        `${event.start.getDate()}(${event.start.toLocaleDateString('ko-KR', { weekday: 'short' })})`
                                    ) : (
                                        `${event.start.getDate()}~${event.end.getDate()}`
                                    )}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                    {event.type !== 'PROGRAM' && (
                                        <span className={`px-2 py-0.5 rounded-toss-md text-[9px] font-bold uppercase tracking-tight ${
                                            event.category_id === 'RENTAL'
                                                ? 'bg-indigo-50 text-indigo-600'
                                                : event.catName === '휴관' ? 'bg-tossError/10 text-tossError' : 'bg-tossGrey100 text-tossGrey600'
                                        }`}>
                                            {event.catName}
                                        </span>
                                    )}
                                    {(event.type === 'PROGRAM' || event.category_id === 'RENTAL') && (
                                        <span className="text-[11.5px] font-semibold text-tossGrey500 flex items-center gap-1.5 flex-wrap">
                                            <Clock size={11} className="shrink-0 text-tossGrey400" />
                                            <span className="tracking-tight text-tossGrey600">
                                                {event.type === 'PROGRAM' ? (
                                                    `${formatKoreanTimeRange(event.program_date || event.program_start_date || event.start, event.program_duration)}${event.program_location ? ` · ${event.program_location}` : ''}`
                                                ) : event.category_id === 'RENTAL' ? (
                                                    `${event.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${event.end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                                                ) : (
                                                    new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
                                                )}
                                            </span>
                                        </span>
                                    )}
                                </div>
                                {event.category_id === 'RENTAL' ? (
                                    <div className="space-y-0.5">
                                        <h4 className="font-extrabold text-tossGrey900 text-[14.5px] tracking-tight leading-snug truncate">
                                            {event.meetingName}
                                        </h4>
                                        <p className="text-[10px] text-tossGrey500 font-bold flex items-center gap-1.5 mt-0.5">
                                            <span className="px-1.5 py-0.5 bg-tossGrey100 text-tossGrey600 rounded text-[9px]">
                                                {event.regionName}
                                            </span>
                                            <span>{event.spaceName}</span>
                                        </p>
                                    </div>
                                ) : (
                                    <h4 className="font-extrabold text-tossGrey950 text-[15px] tracking-tight leading-snug truncate">{event.title}</h4>
                                )}
                            </div>
                            <ChevronRight size={16} className="text-tossGrey300 group-hover:text-tossBlue transition-colors" />
                        </motion.div>
                    ));
                })()}
            </div>
            </div>
        </div>
    );
};

export default StudentCalendarTab;
