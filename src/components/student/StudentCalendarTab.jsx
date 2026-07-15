import React from 'react';
import { motion } from 'framer-motion';
import { Info, Clock, ChevronRight, MapPin } from 'lucide-react';
import { startOfDay, isSameDay } from 'date-fns';
import { CATEGORIES } from '../../constants/appConstants';
import TodayOperatingWidget from './components/TodayOperatingWidget';
import WeeklyOperatingWidget from './components/WeeklyOperatingWidget';
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
                <div className="mb-4 space-y-4">
                    <TodayOperatingWidget studentRegion={studentRegion} />
                    <WeeklyOperatingWidget 
                        studentRegion={studentRegion} 
                        adminSchedules={adminSchedules} 
                        calendarCategories={calendarCategories} 
                    />
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
                                        if (studentRegion === '강동') {
                                            baseTitle = '하이픈 휴무';
                                        } else if (studentRegion === '강서') {
                                            baseTitle = '이높플레이스 휴무';
                                        } else {
                                            const spaces = parsed.closed_spaces.map(s => s === 'HAIFN' ? '하이픈' : '이높플레이스').join(', ');
                                            baseTitle = spaces ? `${spaces} 휴무` : '센터 휴무';
                                        }
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
                            // Only show closure events if they apply to the student's region
                            if (e.catName === '휴관') {
                                try {
                                    const parsed = JSON.parse(e.content);
                                    if (parsed && typeof parsed === 'object' && parsed.closed_spaces) {
                                        const closedSpaces = parsed.closed_spaces;
                                        if (studentRegion === '강동') {
                                            return closedSpaces.includes('HAIFN');
                                        } else if (studentRegion === '강서') {
                                            return closedSpaces.includes('ENOUGH_PLACE') || closedSpaces.includes('ENOUGH_PLACE');
                                        }
                                    }
                                } catch (err) { }
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

                    return (
                        <div className="bg-white rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-[#f2f4f6] divide-y divide-[#f2f4f6]">
                            {sortedEvents.map((event, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className={`flex gap-5 items-center py-4 text-left group cursor-pointer ${idx === 0 ? 'pt-0' : ''} ${idx === sortedEvents.length - 1 ? 'pb-0' : ''}`}
                                    onClick={() => event.type === 'PROGRAM' ? openNoticeDetail(event) : null}
                                >
                                    {/* Left: Flat Date */}
                                    <div className="flex flex-col items-start justify-center min-w-[56px] shrink-0 text-left">
                                        <span className="text-[11px] font-bold text-[#8b95a1] uppercase mb-0.5 tracking-wider">
                                            {event.start.getMonth() + 1}월
                                        </span>
                                        <div className="flex items-baseline gap-0.5">
                                            <span className="text-[22px] font-black text-[#191f28] tracking-tight leading-none">
                                                {event.start.getDate()}
                                            </span>
                                            <span className={`text-[13px] font-bold ${
                                                event.start.getDay() === 0 ? 'text-[#f04438]' : event.start.getDay() === 6 ? 'text-[#3182f6]' : 'text-[#8b95a1]'
                                            }`}>
                                                ({event.start.toLocaleDateString('ko-KR', { weekday: 'short' })})
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right: Clean stacked typography with icons */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-[#191f28] text-[16px] tracking-tight mb-1.5 truncate group-hover:text-[#3182f6] transition-colors">
                                            {event.category_id === 'RENTAL' ? event.meetingName : event.title}
                                        </h4>
                                        
                                        <div className="flex flex-col gap-1 text-[13px] text-[#8b95a1] font-semibold">
                                            {event.catName !== '휴관' && (
                                                <div className="flex items-center gap-1">
                                                    <Clock size={13} className="shrink-0 text-[#8b95a1]" />
                                                    <span>
                                                        {event.type === 'PROGRAM' ? (
                                                            formatKoreanTimeRange(event.program_date || event.program_start_date || event.start, event.program_duration)
                                                        ) : event.category_id === 'RENTAL' ? (
                                                            `${event.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${event.end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                                                        ) : (
                                                            new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            
                                            {(event.program_location || event.spaceName) && (
                                                <div className="flex items-center gap-1 text-[#4e5968] font-bold truncate mt-0.5">
                                                    <MapPin size={13} className="shrink-0 text-[#8b95a1]" />
                                                    <span className="truncate">
                                                        {event.category_id === 'RENTAL' ? event.spaceName : event.program_location}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <ChevronRight size={18} className="text-[#ccc] group-hover:text-[#3182f6] group-hover:translate-x-0.5 transition-all shrink-0" />
                                </motion.div>
                            ))}
                        </div>
                    );
                })()}
            </div>
            </div>
        </div>
    );
};

export default StudentCalendarTab;
