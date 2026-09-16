import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { useDutyRoster } from '../../hooks/useDutyRoster';
import { kstDateKey, getMonthGrid, shiftCalendarMonth, dateHeading, calendarWeekday, buildCalendarEvents, getCalendarAgenda } from '../../utils/calendarUtils';
import { getRecruitment, toKstInput } from '../../utils/programRecruitment';
import { formatKoreanTimeRange } from '../../utils/dateUtils';
import RecruitmentBadge from './components/RecruitmentBadge';
import UserAvatar from '../common/UserAvatar';
import { getCalendarEventTheme } from '../../utils/calendarColors';
import { usesDailySessionRsvp } from '../../utils/dailyProgramSessions';

const StudentCalendarTab = ({
    adminSchedules = [], notices = [], calendarCategories = [], openNoticeDetail,
    studentRegion, tutorialMode = false, tutorialPrograms = [], onTutorialEventOpen,
    initialDate, dutyAssignments, operatingHours: suppliedHours,
}) => {
    const now = useCurrentTime();
    const today = kstDateKey(now);
    const initial = initialDate || today;
    const [month, setMonth] = useState(initial.slice(0, 7));
    // On a normal tab entry, show the whole month's agenda. A date is selected
    // only when the user taps one (or when another screen deep-links a date).
    const [selectedDate, setSelectedDate] = useState(initialDate || null);
    const [hours, setHours] = useState(suppliedHours || null);
    const [dailyProgramSessions, setDailyProgramSessions] = useState([]);
    // Existing student screens route every non-Gangseo account to HAIFN. Keep
    // the calendar consistent when a legacy/custom school has no region row.
    const isHaifnCenter = studentRegion !== '강서';
    const duty = useDutyRoster(month, isHaifnCenter && dutyAssignments === undefined);
    const roster = dutyAssignments ?? duty.roster;
    const days = useMemo(() => getMonthGrid(month), [month]);
    const dailyNoticeIds = useMemo(
        () => notices.filter(usesDailySessionRsvp).map(notice => notice.id),
        [notices]
    );
    const calendarPrograms = useMemo(() => {
        const sessionsByNotice = new Map();
        dailyProgramSessions.forEach(session => {
            if (!sessionsByNotice.has(session.notice_id)) sessionsByNotice.set(session.notice_id, []);
            sessionsByNotice.get(session.notice_id).push(session);
        });
        return notices.map(notice => usesDailySessionRsvp(notice)
            ? { ...notice, daily_program_sessions: sessionsByNotice.get(notice.id) || [] }
            : notice);
    }, [notices, dailyProgramSessions]);
    const eventsByDay = useMemo(() => buildCalendarEvents({
        programs: [...calendarPrograms, ...(tutorialMode ? tutorialPrograms : [])],
        schedules: adminSchedules, categories: calendarCategories, region: studentRegion, days,
    }), [calendarPrograms, tutorialMode, tutorialPrograms, adminSchedules, calendarCategories, studentRegion, days]);

    useEffect(() => {
        let active = true;
        if (!dailyNoticeIds.length || !days.length) {
            setDailyProgramSessions([]);
            return () => { active = false; };
        }

        supabase
            .from('daily_program_sessions')
            .select('id, notice_id, session_date, starts_at, status, capacity, voided_at')
            .in('notice_id', dailyNoticeIds)
            .is('voided_at', null)
            .gte('session_date', days[0])
            .lte('session_date', days[days.length - 1])
            .order('session_date', { ascending: true })
            .then(({ data, error }) => {
                if (!active) return;
                if (error) {
                    console.error('회차형 프로그램 일정을 불러오지 못했습니다:', error);
                    setDailyProgramSessions([]);
                    return;
                }
                setDailyProgramSessions(data || []);
            });
        return () => { active = false; };
    }, [dailyNoticeIds, days]);

    useEffect(() => {
        if (suppliedHours !== undefined) { setHours(suppliedHours); return; }
        let active = true;
        supabase.from('notices').select('content').eq('category', 'SYSTEM').eq('title', 'OPERATING_HOURS_CONFIG').maybeSingle()
            .then(({ data }) => {
                if (!active) return;
                try { setHours(data?.content ? JSON.parse(data.content) : null); } catch { setHours(null); }
            }).catch(() => { if (active) setHours(null); });
        return () => { active = false; };
    }, [suppliedHours]);

    const changeMonth = (amount) => {
        const next = shiftCalendarMonth(month, amount);
        setMonth(next);
        setSelectedDate(null);
    };
    const selectDay = (day) => { setSelectedDate(day); if (day.slice(0, 7) !== month) setMonth(day.slice(0, 7)); };
    // Keep closure records for date colours, without rendering them as events.
    const selectedEvents = getCalendarAgenda(eventsByDay, month, selectedDate, today);
    const assignment = roster?.[selectedDate];
    const hasDutyAssignment = assignment?.duty_status === 'ASSIGNED' && Boolean(assignment.staff_name?.trim());
    const space = studentRegion === '강동' ? '하이픈' : studentRegion === '강서' ? '이높플레이스' : '';
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];
    const spaceHours = hours?.[space] || (hours?.monday ? hours : null);
    const isClosedDay = (day) => (eventsByDay[day] || []).some(event => event.type === 'CLOSED')
        || (isHaifnCenter && roster?.[day]?.duty_status === 'OFF' && roster[day].label === '추석연휴')
        || Boolean(spaceHours && !spaceHours[weekdays[calendarWeekday(day)]]?.isOpen);
    const dayHours = selectedDate ? spaceHours?.[weekdays[calendarWeekday(selectedDate)]] : null;
    const selectedClosed = Boolean(selectedDate && isClosedDay(selectedDate));
    const hoursText = !selectedClosed && dayHours?.isOpen ? `${dayHours.open} ~ ${dayHours.close}` : '';

    return <div className="animate-fade-in pb-24 min-h-screen bg-[#F7EFE2]">
        <header className="relative mb-5 overflow-hidden rounded-b-[30px] bg-[#CF3A27] px-5 pb-7 pt-6 text-white shadow-[0_8px_24px_rgba(207,58,39,0.18)]">
            <div aria-hidden="true" className="absolute -right-7 -top-8 h-24 w-24 rounded-full bg-[#F8DF53]" />
            <div aria-hidden="true" className="absolute -bottom-9 right-16 h-20 w-28 rounded-t-full bg-[#E88AAC]/85" />
            <div className="relative z-10">
                <h2 className="text-[24px] font-black tracking-[-0.04em]">캘린더</h2>
                <p className="mt-1 text-xs font-semibold text-white/80">우리가 서로 연결되는 시간</p>
            </div>
        </header>
        <div className="mx-4 overflow-hidden rounded-[24px] border border-[#E7D8C4] bg-white shadow-[0_5px_16px_rgba(82,55,33,0.07)]">
            <div className="px-4 pt-5 pb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F4DDD4] text-[#CF3A27]"><CalendarDays size={18} /></span>
                <div>
                    <h3 className="text-[15px] font-bold text-tossGrey900">센터 일정</h3>
                    <p className="mt-1 text-[11px] font-semibold text-tossGrey500">함께할 수 있는 일정을 확인해보세요</p>
                </div>
            </div>
            <div className="px-3 pt-2 pb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                    <button aria-label="이전 달" onClick={() => changeMonth(-1)} className="p-2 rounded-xl text-tossGrey500 hover:bg-tossGrey50"><ChevronLeft size={18} /></button>
                    <h3 aria-live="polite" className="text-base font-bold text-tossGrey900 tabular-nums">{Number(month.slice(0, 4))}년 {Number(month.slice(5))}월</h3>
                    <button aria-label="다음 달" onClick={() => changeMonth(1)} className="p-2 rounded-xl text-tossGrey500 hover:bg-tossGrey50"><ChevronRight size={18} /></button>
                </div>
                <button onClick={() => { setMonth(today.slice(0, 7)); setSelectedDate(today); }} className="rounded-full bg-tossGrey50 px-3 py-2 text-xs font-bold text-tossGrey600">오늘</button>
            </div>
            <div className="grid grid-cols-7 px-2 pb-2" aria-hidden="true">
                {weekdayLabels.map((day, index) => {
                    const closed = spaceHours ? !spaceHours[weekdays[index]]?.isOpen : index === 0 || index === 6;
                    return <div key={day} className="flex justify-center py-1"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${closed ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>{day}</span></div>;
                })}
            </div>
            <div className="grid grid-cols-7 gap-y-1 px-2 pb-3" data-tour="calendar-schedule-list">
                {days.map(day => {
                    const events = eventsByDay[day].filter(event => event.type !== 'CLOSED');
                    const inMonth = day.startsWith(month);
                    const selected = day === selectedDate;
                    const isToday = day === today;
                    const closed = isClosedDay(day);
                    const circleColor = selected
                        ? 'bg-[#CF3A27] text-white ring-4 ring-[#F4DDD4]'
                        : isToday
                            ? 'border border-[#CF3A27] bg-white text-[#CF3A27]'
                            : closed ? 'text-red-500' : 'text-tossGrey700';
                    return <button key={day} type="button" aria-label={`${dateHeading(day)}, 일정 ${events.length}개`} aria-pressed={selected}
                        onClick={() => selectDay(day)}
                        className={`flex flex-col items-center min-w-0 min-h-[66px] sm:min-h-[74px] rounded-2xl p-1 pt-2.5 text-left border transition-colors focus-visible:outline-[#CF3A27] ${selected ? 'bg-[#FBF3E7] border-[#CF3A27]/30 shadow-sm' : 'border-transparent hover:bg-tossGrey50'} ${inMonth ? '' : 'opacity-40'}`}>
                        <span className={`mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-extrabold ${circleColor}`}>{Number(day.slice(8))}</span>
                        <div className="mt-auto flex min-h-4 items-center justify-center gap-1 pb-1">
                            {events.slice(0, 3).map(event => (
                                <span key={event.id} title={event.title} className={`h-1.5 w-1.5 rounded-full ${event.type === 'PROGRAM' ? 'bg-[#CF3A27]' : event.type === 'RENTAL' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            ))}
                            {events.length > 3 && <span className="text-[8px] font-black text-slate-400">+{events.length - 3}</span>}
                        </div>
                    </button>;
                })}
            </div>
        </div>
        <section className="mx-4 mt-5" aria-label={selectedDate ? '선택한 날짜 일정' : '해당 월 전체 일정'}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h3 className={`text-base font-bold ${selectedClosed ? 'text-red-500' : 'text-tossGrey900'}`}>{selectedDate ? dateHeading(selectedDate) : `${Number(month.slice(5))}월 전체 일정`}</h3>
                {selectedDate && <button type="button" onClick={() => setSelectedDate(null)} className="text-xs font-bold text-tossBlue">월 전체 보기</button>}
                {hoursText && <span className="flex items-center gap-1 text-xs font-semibold text-tossGrey500"><Clock size={12} />운영 시간 <strong className="text-tossBlue">{hoursText}</strong></span>}
            </div>
            {selectedDate && selectedDate < today && hoursText && <p className="text-[10px] text-tossGrey400 mb-3">운영 시간은 현재 등록된 정기 운영 기준입니다.</p>}
            {selectedDate && isHaifnCenter && (selectedClosed ? <div role="status" className="mb-4 rounded-[22px] border border-[#E7D8C4] bg-white px-5 py-5 flex items-center gap-3 shadow-[0_5px_16px_rgba(82,55,33,0.07)]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500"><CalendarDays size={18} /></span>
                <p className="text-sm font-bold text-tossGrey700">하이픈 휴관일입니다</p>
            </div> : hasDutyAssignment ? <div className="mb-4 flex items-center gap-3 rounded-[22px] border border-[#E7D8C4] bg-white px-5 py-4 shadow-[0_5px_16px_rgba(82,55,33,0.07)]">
                <UserAvatar key={`${assignment?.staff_id || assignment?.staff_name || 'empty'}-${assignment?.staff?.profile_image_url || ''}`}
                    user={assignment?.duty_status === 'ASSIGNED' ? { ...assignment.staff, name: assignment.staff_name } : null}
                    size="w-9 h-9" textSize="text-sm" />
                <div className="min-w-0 flex-1"><p className="mb-0.5 text-[11px] font-semibold text-tossGrey500">오늘 센터에서 만나요</p>
                    <p className="truncate text-sm font-bold text-tossGrey800">당직 근무자 · {assignment.staff_name}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#F4DDD4] px-2.5 py-1 text-[10px] font-bold text-[#CF3A27]">근무 중</span>
            </div> : null)}
            {selectedDate && isHaifnCenter && !selectedClosed && dutyAssignments === undefined && duty.error && <div role="status" className="mb-4 flex items-center gap-2 text-xs text-tossGrey500">
                <span>{duty.error}</span><button className="text-blue-600" onClick={duty.refresh}>다시 시도</button>
            </div>}
            <div className="space-y-3">
                {selectedEvents.map(({ event, date }) => {
                    const recruitment = getRecruitment(event.raw, now);
                    const isProgram = event.type === 'PROGRAM';
                    const isCompletedProgram = isProgram && (
                        date < today
                        || event.raw.program_status === 'COMPLETED'
                        || (event.raw.guest_properties?.is_ended ?? event.raw.is_ended) === true
                    );
                    const canOpen = isProgram && recruitment.status !== 'SCHEDULED';
                    const theme = getCalendarEventTheme(event, calendarCategories);
                    const open = () => {
                        if (!canOpen) return;
                        if (event.raw.tutorial_mode) onTutorialEventOpen?.(event.raw);
                        openNoticeDetail?.(event.raw, 'calendar');
                    };
                    return <button key={event.id} type="button" onClick={open} disabled={!canOpen}
                        data-tour={event.raw.tutorial_mode ? 'tutorial-calendar-event' : undefined} data-tour-label={event.raw.tutorial_mode ? event.title : undefined}
                        className={`group flex w-full items-center gap-4 sm:gap-6 rounded-[22px] border px-5 sm:px-6 text-left transition-shadow disabled:cursor-default ${isProgram ? 'border-l-4 py-5 shadow-toss-subtle' : 'border-[#E7D8C4] bg-white py-4'} ${isCompletedProgram ? 'border-slate-200 border-l-slate-300 bg-slate-50/90' : isProgram ? 'border-[#E7D8C4] border-l-[#CF3A27] bg-white' : ''} ${canOpen ? 'hover:shadow-toss-standard' : ''}`}>
                        <span className="w-12 sm:w-14 shrink-0">
                            <span className="block text-xs font-bold text-tossGrey500">{Number(date.slice(5, 7))}월</span>
                            <span className={`text-xl font-extrabold ${isCompletedProgram ? 'text-slate-500' : isClosedDay(date) ? 'text-red-500' : 'text-tossGrey900'}`}>{Number(date.slice(8))}<span className="ml-0.5 text-[11px] font-bold text-tossGrey500">({weekdayLabels[calendarWeekday(date)]})</span></span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-2">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className={`text-sm break-words ${isProgram ? 'font-bold' : 'font-semibold'} ${isCompletedProgram ? 'text-slate-600' : 'text-tossGrey900'}`}>{event.title}</span>
                                <span className={`rounded-md px-2 py-1 text-[10px] font-bold whitespace-nowrap ${isProgram ? isCompletedProgram ? 'bg-slate-200 text-slate-600' : 'bg-[#191F28] text-white' : `${theme.background} text-tossGrey900`}`}>{isProgram ? '프로그램' : event.type === 'RENTAL' ? '대관' : '센터 일정'}</span>
                                {isCompletedProgram
                                    ? <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-500"><CheckCircle2 size={11} />진행 완료</span>
                                    : isProgram && <RecruitmentBadge program={event.raw} now={now} />}
                            </span>
                            {isProgram && recruitment.status === 'SCHEDULED' && <span className="text-xs leading-relaxed font-semibold text-tossBlue">{recruitment.message}</span>}
                            {isProgram && recruitment.preparing && recruitment.status !== 'SCHEDULED' && <span className="text-xs text-tossGrey500">상세 정보 준비 중</span>}
                            {isProgram && recruitment.canViewDetails && <span className="flex items-center gap-1 text-xs font-semibold text-tossGrey500"><Clock size={12} className="shrink-0" />{formatKoreanTimeRange(toKstInput(event.raw.program_date || event.raw.program_start_date), event.raw.program_duration)}</span>}
                            {recruitment.canViewDetails && event.raw.program_location && <span className="flex items-center gap-1 text-xs font-semibold text-tossGrey700"><MapPin size={12} className="shrink-0 text-tossGrey500" />{event.raw.program_location}</span>}
                        </span>
                        {canOpen && <ChevronRight size={16} className="shrink-0 text-tossGrey400" />}
                    </button>;
                })}
                {!selectedEvents.length && <div className="rounded-3xl bg-white py-8 text-center text-tossGrey400"><CalendarDays size={24} className="mx-auto mb-2 opacity-60" /><p className="text-xs">등록된 일정이 없습니다.</p></div>}
            </div>
        </section>
    </div>;
};

export default StudentCalendarTab;
