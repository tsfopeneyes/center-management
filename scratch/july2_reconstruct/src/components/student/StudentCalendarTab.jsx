import React from 'react';
import { motion } from 'framer-motion';
import { Info, Clock, ChevronRight } from 'lucide-react';
import { startOfDay, isSameDay } from 'date-fns';
import { CATEGORIES } from '../../constants/appConstants';
import TodayOperatingWidget from './components/TodayOperatingWidget';

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
                    const sortedEvents = [...adminSchedules, ...notices.filter(n => n.category === CATEGORIES.PROGRAM)]
                        .map(e => {
                            const isProgram = e.category === CATEGORIES.PROGRAM;
                            const cat = calendarCategories.find(c => c.id === e.category_id);
                            let catName = isProgram ? (e.program_type === 'SCHOOL_CHURCH' ? '스처 프로그램' : '센터 프로그램') : cat?.name || '기타';
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
                            const start = isProgram ? rawDate : startOfDay(rawDate);
                            const end = isProgram ? start : startOfDay(new Date(e.end_date || e.start_date));

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
                            className="px-4 py-3 bg-white rounded-toss-lg shadow-toss-subtle border-none flex gap-3 items-center group active:scale-[0.98] transition-all text-left"
                            onClick={() => event.type === 'PROGRAM' ? openNoticeDetail(event) : null}
                        >
                            <div className="flex flex-col items-center justify-center min-w-[70px] py-1 border-r border-tossGrey100 pr-4">
                                <span className="text-[10px] font-bold text-tossGrey400 uppercase">{event.start.toLocaleString('ko-KR', { month: 'short' })}</span>
                                <span className="text-xl font-bold text-tossGrey800 tracking-tighter">
                                    {isSameDay(event.start, event.end) ? event.start.getDate() : `${event.start.getDate()}~${event.end.getDate()}`}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded-toss-md text-[9px] font-bold uppercase tracking-tight ${
                                        event.type === 'PROGRAM'
                                            ? (event.program_type === 'SCHOOL_CHURCH' ? 'bg-[#a234c7]/10 text-[#a234c7]' : 'bg-tossBlueLight text-tossBlue')
                                            : event.catName === '휴관' ? 'bg-tossError/10 text-tossError' : 'bg-tossGrey100 text-tossGrey600'
                                    }`}>
                                        {event.catName}
                                    </span>
                                    {event.type === 'PROGRAM' && <span className="text-[9px] font-bold text-tossGrey500 uppercase tracking-widest flex items-center gap-1"><Clock size={10} /> {new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
                                </div>
                                <h4 className="font-bold text-tossGrey800 text-sm truncate">{event.title}</h4>
                            </div>
                            <ChevronRight size={16} className="text-tossGrey300 group-active:text-tossBlue transition-colors" />
                        </motion.div>
                    ));
                })()}
            </div>
            </div>
        </div>
    );
};

export default StudentCalendarTab;
