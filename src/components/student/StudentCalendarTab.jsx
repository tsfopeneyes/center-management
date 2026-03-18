import React from 'react';
import { motion } from 'framer-motion';
import { Info, Clock, ChevronRight } from 'lucide-react';
import { startOfDay, isSameDay } from 'date-fns';
import { CATEGORIES } from '../../constants/appConstants';

const StudentCalendarTab = ({
    adminSchedules,
    notices,
    calendarCategories,
    openNoticeDetail
}) => {
    return (
        <div className="p-5 pt-6 pb-32 bg-white rounded-t-[30px] shadow-sm mt-2 min-h-[calc(100vh-80px)]">
            <h1 className="text-3xl font-black text-gray-800 mb-2">캘린더 📅</h1>
            <p className="text-gray-500 text-[15px] mb-6 font-medium">센터의 전체 일정을 한눈에 확인하세요</p>

            <div className="mb-6 p-4 rounded-2xl bg-red-50/80 border border-red-100 flex items-center gap-3">
                <Info size={20} className="text-red-500 shrink-0" />
                <p className="text-sm font-bold text-red-700">
                    매주 <span className="font-black underline decoration-red-300 decoration-2 underline-offset-2">화, 토, 일</span>은 센터 정기 휴관일입니다.
                </p>
            </div>

            <div className="space-y-4">
                {/* Group schedules by date or simple list for now, 
                but a list of upcoming events is often better for mobile */}
                {(() => {
                    const sortedEvents = [...adminSchedules, ...notices.filter(n => n.category === CATEGORIES.PROGRAM)]
                        .map(e => {
                            const isProgram = e.category === CATEGORIES.PROGRAM;
                            const cat = calendarCategories.find(c => c.id === e.category_id);
                            let catName = isProgram ? '프로그램' : cat?.name || '기타';
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

                            const start = startOfDay(new Date(e.start_date || e.program_date));
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
                            // Hide regular recurring closures (Tuesday=2, Saturday=6, Sunday=0) to prevent clutter
                            if (e.catName === '휴관') {
                                const day = e.start.getDay();
                                if (day === 0 || day === 2 || day === 6) {
                                    return false;
                                }
                            }
                            return true;
                        })
                        .sort((a, b) => a.start - b.start);

                    if (sortedEvents.length === 0) return <div className="text-center py-20 text-gray-400">등록된 추가 일정이 없습니다.</div>;

                    return sortedEvents.map((event, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-4 bg-white rounded-[1.5rem] border border-gray-100 shadow-sm flex gap-4 items-center group active:scale-[0.98] transition-all"
                            onClick={() => event.type === 'PROGRAM' ? openNoticeDetail(event) : null}
                        >
                            <div className="flex flex-col items-center justify-center min-w-[70px] py-1 border-r border-gray-50 pr-4">
                                <span className="text-[10px] font-black text-gray-400 uppercase">{event.start.toLocaleString('ko-KR', { month: 'short' })}</span>
                                <span className="text-xl font-black text-gray-800 tracking-tighter">
                                    {isSameDay(event.start, event.end) ? event.start.getDate() : `${event.start.getDate()}~${event.end.getDate()}`}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight ${event.type === 'PROGRAM' ? 'bg-pink-100 text-pink-600' :
                                        event.catName === '휴관' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                        }`}>
                                        {event.catName}
                                    </span>
                                    {event.type === 'PROGRAM' && <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1"><Clock size={10} /> {new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
                                </div>
                                <h4 className="font-bold text-gray-800 text-sm truncate">{event.title}</h4>
                            </div>
                            <ChevronRight size={16} className="text-gray-300 group-active:text-blue-500 transition-colors" />
                        </motion.div>
                    ));
                })()}
            </div>
        </div>
    );
};

export default StudentCalendarTab;
