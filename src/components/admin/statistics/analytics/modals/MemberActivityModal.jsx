import React, { useState, useMemo } from 'react';
import { Award, ChevronLeft, ChevronRight, MapPin, Clock } from 'lucide-react';
import { format, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { aggregateVisitSessions } from '../../../../../utils/visitUtils';

const MemberActivityModal = ({ member, logs, locations, notices, responses, users, year: initialYear, month: initialMonth, onClose }) => {
    const [currentDate, setCurrentDate] = useState(new Date(initialYear, initialMonth, 1));
    const [selectedDate, setSelectedDate] = useState(null);
    
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Filter logs for this member using all valid check-in/move types to match analytics data
    const visitDates = useMemo(() => {
        const validTypes = ['CHECKIN', 'CHECKOUT', 'MOVE', 'GUEST_ENTRY'];
        const memberLogs = logs.filter(l => l.user_id === member.id && validTypes.includes(l.type));
        return Array.from(new Set(memberLogs.map(l => format(parseISO(l.created_at), 'yyyy-MM-dd'))));
    }, [logs, member.id]);

    const dailySessions = useMemo(() => {
        if (!locations || !users || !logs) return {};
        
        const memberLogs = logs.filter(l => l.user_id === member.id);
        const sessions = aggregateVisitSessions(memberLogs, users, locations); 
        
        const map = {};
        sessions.forEach(s => {
            if (!map[s.date]) map[s.date] = { duration: 0, spaces: new Set() };
            map[s.date].duration += parseInt(s.durationMin) || 0;
            if (s.usedSpaces) {
                s.usedSpaces.split('-').forEach(sp => {
                    if (sp && sp !== '-') map[s.date].spaces.add(sp);
                });
            }
        });
        return map;
    }, [logs, member.id, locations, users]);

    const dailyPrograms = useMemo(() => {
        if (!notices || !responses) return {};
        
        const attendedResponses = responses.filter(r => r.user_id === member.id && r.is_attended);
        const noticeIds = new Set(attendedResponses.map(r => r.notice_id));
        
        const programs = notices.filter(n => noticeIds.has(n.id) && n.category === 'PROGRAM');
        
        const map = {};
        programs.forEach(p => {
            const dateStr = p.program_date ? format(parseISO(p.program_date), 'yyyy-MM-dd') : format(parseISO(p.created_at), 'yyyy-MM-dd');
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push(p);
        });
        return map;
    }, [notices, responses, member.id]);

    const startDay = monthStart.getDay();
    const blanks = Array.from({ length: startDay }, (_, i) => i);

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">{member.name} <span className="text-sm font-normal text-gray-400">방문 이력</span></h3>
                        <div className="flex items-center gap-2 mt-1">
                            <button 
                                onClick={() => {
                                    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
                                    setSelectedDate(null);
                                }}
                                className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <p className="text-xs text-blue-600 font-bold select-none">{format(monthStart, 'yyyy년 M월')}</p>
                            <button 
                                onClick={() => {
                                    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
                                    setSelectedDate(null);
                                }}
                                className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition text-gray-400 hover:text-gray-600">
                        <Award size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {blanks.map(i => <div key={`blank-${i}`} />)}
                        {days.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const isVisited = visitDates.includes(dateStr);
                            const programs = dailyPrograms[dateStr] || [];
                            const isProgram = programs.length > 0;
                            const isToday = isSameDay(day, new Date());
                            const isSelected = selectedDate === dateStr;

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                                    disabled={!isVisited && !isProgram}
                                    className={`
                                        aspect-square flex items-center justify-center rounded-xl text-sm font-bold transition
                                        ${isProgram ? 'bg-rose-500 text-white shadow-sm' 
                                            : isVisited ? 'bg-blue-600 text-white shadow-sm' 
                                                : 'text-gray-700 hover:bg-gray-100'}
                                        ${isToday ? 'border-2 border-rose-200' : ''}
                                        ${isSelected ? 'ring-2 ring-offset-2 ring-rose-400 scale-105' : ''}
                                        ${!isVisited && !isProgram ? 'opacity-50 cursor-default hover:bg-transparent' : 'cursor-pointer hover:bg-blue-700 active:scale-95'}
                                    `}
                                    title={isProgram ? '프로그램 참석' : isVisited ? '센터 방문' : ''}
                                >
                                    {day.getDate()}
                                </button>
                            );
                        })}
                    </div>

                    {/* Activity Legends */}
                    <div className="mt-6 flex items-center gap-4 text-xs justify-center mb-4 border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-1.5 font-bold">
                            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                            <span className="text-gray-600">센터 방문</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold">
                            <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                            <span className="text-gray-600">프로그램 참여</span>
                        </div>
                    </div>

                    {/* Selected Date Detail */}
                    {selectedDate && (visitDates.includes(selectedDate) || dailyPrograms[selectedDate]) && (
                        <div className="mt-2 p-4 bg-gray-50 rounded-xl space-y-3 animate-fade-in text-left border border-gray-100">
                            <div className="text-xs font-bold text-gray-800 border-b border-gray-200 pb-2">
                                {format(parseISO(selectedDate), 'yyyy년 M월 d일')} 활동 내역
                            </div>
                            
                            {visitDates.includes(selectedDate) && dailySessions[selectedDate] && (
                                <div className="flex flex-col gap-1.5 pt-1">
                                    <div className="flex items-center gap-2 text-xs">
                                        <MapPin size={14} className="text-blue-500 shrink-0" />
                                        <span className="font-bold text-gray-700 w-16">이용 공간</span>
                                        <span className="text-gray-600 flex-1 truncate">{Array.from(dailySessions[selectedDate].spaces).join(', ') || '알 수 없음'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <Clock size={14} className="text-blue-500 shrink-0" />
                                        <span className="font-bold text-gray-700 w-16">이용 시간</span>
                                        <span className="text-gray-600 flex-1">{Math.floor(dailySessions[selectedDate].duration / 60)}시간 {dailySessions[selectedDate].duration % 60}분</span>
                                    </div>
                                </div>
                            )}

                            {dailyPrograms[selectedDate]?.map(p => (
                                <div key={p.id} className="mt-3 bg-white p-3 rounded-lg shadow-sm border border-rose-100">
                                    <div className="flex gap-2 items-center mb-1">
                                        <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider shrink-0">PROGRAM</span>
                                        <span className="text-xs font-bold text-gray-800 line-clamp-1">{p.title}</span>
                                    </div>
                                    {p.short_description && <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">{p.short_description}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 pt-0 mt-auto shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MemberActivityModal;
