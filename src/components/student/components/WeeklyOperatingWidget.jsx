import React, { useState, useEffect } from 'react';
import { Clock, Calendar, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { startOfDay, addDays, startOfWeek } from 'date-fns';

const WeeklyOperatingWidget = ({ studentRegion, adminSchedules, calendarCategories }) => {
    const [operatingHours, setOperatingHours] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHours = async () => {
            try {
                const { data } = await supabase
                    .from('notices')
                    .select('content')
                    .eq('category', 'SYSTEM')
                    .eq('title', 'OPERATING_HOURS_CONFIG')
                    .maybeSingle();

                if (data?.content) {
                    setOperatingHours(JSON.parse(data.content));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchHours();
    }, []);

    if (loading) return null;

    // Get current week dates (Monday to Sunday)
    const today = new Date();
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

    const dayNameMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const koDayMap = ['일', '월', '화', '수', '목', '금', '토'];

    const getDayStatus = (date) => {
        const targetDate = startOfDay(date);
        
        // 1. Check special closures
        const isClosed = adminSchedules.some(sch => {
            const cat = calendarCategories.find(c => c.id === sch.category_id);
            if (cat?.name !== '휴관') return false;

            const start = startOfDay(new Date(sch.start_date));
            const end = startOfDay(new Date(sch.end_date));

            if (targetDate >= start && targetDate <= end) {
                let closedSpaces = [];
                try {
                    const parsed = JSON.parse(sch.content);
                    if (parsed && typeof parsed === 'object' && parsed.closed_spaces) {
                        closedSpaces = parsed.closed_spaces;
                    }
                } catch (e) { }

                if (studentRegion === '강동') {
                    return closedSpaces.includes('HYPHEN');
                } else if (studentRegion === '강서') {
                    return closedSpaces.includes('INOP') || closedSpaces.includes('ENOF');
                }
                return true;
            }
            return false;
        });

        if (isClosed) {
            return { status: 'CLOSED', text: '휴무' };
        }

        // 2. Check regular operating config
        const dayOfWeekStr = dayNameMap[date.getDay()];
        const dayConfig = operatingHours ? operatingHours[dayOfWeekStr] : null;

        if (dayConfig && dayConfig.isOpen) {
            return { status: 'OPEN', text: `${dayConfig.open} ~ ${dayConfig.close}` };
        }

        return { status: 'CLOSED', text: '휴무' };
    };

    return (
        <div className="bg-white p-5 rounded-toss-xl shadow-toss-standard flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Calendar size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-tossGrey900 text-[15px] tracking-tight leading-none">이번 주 오픈 현황</h3>
                        <p className="text-[11px] text-tossGrey500 font-semibold mt-1">요일별 운영 및 휴무일을 확인하세요</p>
                    </div>
                </div>
                
                {/* Legend (범례) */}
                <div className="flex items-center gap-2.5 text-[10px] font-extrabold text-tossGrey500 select-none">
                    <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                        <span>오픈</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                        <span>휴무</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {weekDays.map((date, idx) => {
                    const { status } = getDayStatus(date);
                    const isToday = startOfDay(date).getTime() === startOfDay(today).getTime();
                    const dayLabel = koDayMap[date.getDay()];
                    const isOpen = status === 'OPEN';
                    
                    let dayCircleClass = "";
                    if (isOpen) {
                        dayCircleClass = isToday 
                            ? 'bg-blue-600 text-white font-extrabold ring-4 ring-blue-100' 
                            : 'bg-blue-50 text-blue-600 font-bold';
                    } else {
                        dayCircleClass = isToday 
                            ? 'bg-red-500 text-white font-extrabold ring-4 ring-red-100' 
                            : 'bg-red-50 text-red-500 font-bold';
                    }

                    return (
                        <div 
                            key={idx} 
                            className={`flex flex-col items-center py-3 px-1 rounded-2xl transition-all border ${
                                isToday 
                                    ? 'bg-tossGrey50/50 border-tossGrey200 shadow-sm' 
                                    : 'bg-transparent border-transparent'
                            }`}
                        >
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] transition-all ${dayCircleClass}`}>
                                {dayLabel}
                            </span>
                            
                            <span className={`text-[13px] font-black mt-2 ${
                                isToday ? 'text-tossGrey900' : 'text-tossGrey700'
                            }`}>
                                {date.getDate()}
                            </span>
                            
                            {isToday && (
                                <span className="text-[8px] text-tossGrey400 font-black mt-0.5 scale-90">
                                    오늘
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WeeklyOperatingWidget;
