import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Users, Check, CalendarDays, Clock3, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { programSessionsApi } from '../../../../../api/programSessionsApi';
import { userApi } from '../../../../../api/userApi';
import { getDailySessionFields, getNextProgramOccurrence, getKstDateString, listProgramOccurrences } from '../../../../../utils/dailyProgramSessions';

const defaultTime = (notice) => {
    const value = notice.program_date;
    if (!value) return notice.program_time || '12:00';
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(date);
    }
    const match = String(value).match(/T(\d{2}:\d{2})/);
    return match?.[1] || notice.program_time || '12:00';
};

const sessionTime = (value, notice) => {
    if (!value) return defaultTime(notice);
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
};

const getProgramHosts = notice => {
    if (Array.isArray(notice.hosts) && notice.hosts.some(host => host?.host_id)) return notice.hosts.filter(host => host?.host_id);
    if (Array.isArray(notice.guest_properties?.cached_hosts) && notice.guest_properties.cached_hosts.some(host => host?.host_id)) {
        return notice.guest_properties.cached_hosts.filter(host => host?.host_id);
    }
    return notice.host_id ? [{ host_id: notice.host_id, one_liner: notice.host_one_liner || '' }] : [];
};

const getSavedSessionHosts = session => {
    const setting = (Array.isArray(session?.session_fields) ? session.session_fields : [])
        .find(field => field?.id === '__session_hosts' && field?.type === 'hosts');
    return Array.isArray(setting?.hosts) ? setting.hosts : null;
};

const SessionDateCalendar = ({ dates, value, openedDates, onChange }) => {
    const firstMonth = String(value || dates[0] || '').slice(0, 7);
    const [visibleMonth, setVisibleMonth] = useState(firstMonth);
    useEffect(() => {
        const selectedMonth = String(value || '').slice(0, 7);
        if (selectedMonth) setVisibleMonth(selectedMonth);
    }, [value]);

    const allowed = useMemo(() => new Set(dates), [dates]);
    const opened = useMemo(() => new Set(openedDates), [openedDates]);
    const months = useMemo(() => [...new Set(dates.map(date => date.slice(0, 7)))], [dates]);
    const monthIndex = months.indexOf(visibleMonth);
    const [year, month] = visibleMonth.split('-').map(Number);
    const firstWeekday = new Date(`${visibleMonth}-01T00:00:00+09:00`).getDay();
    const dayCount = new Date(year, month, 0).getDate();
    const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];
    const moveMonth = offset => {
        const next = months[monthIndex + offset];
        if (next) setVisibleMonth(next);
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <button type="button" disabled={monthIndex <= 0} onClick={() => moveMonth(-1)} className="rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-20"><ChevronLeft size={18}/></button>
                <strong className="text-base font-black text-slate-900">{year}년 {month}월</strong>
                <button type="button" disabled={monthIndex < 0 || monthIndex >= months.length - 1} onClick={() => moveMonth(1)} className="rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-20"><ChevronRight size={18}/></button>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400">
                {['일','월','화','수','목','금','토'].map(day => <span key={day} className="py-1">{day}</span>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
                {cells.map((day, index) => {
                    if (!day) return <span key={`blank-${index}`} />;
                    const date = `${visibleMonth}-${String(day).padStart(2, '0')}`;
                    const canSelect = allowed.has(date);
                    const selected = value === date;
                    const alreadyOpen = opened.has(date);
                    return (
                        <button key={date} type="button" disabled={!canSelect} onClick={() => onChange(date)} className={`relative aspect-square rounded-xl text-sm font-black transition ${selected ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : canSelect ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'text-slate-300'} disabled:cursor-default`}>
                            {day}
                            {alreadyOpen && !selected && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500" />}
                        </button>
                    );
                })}
            </div>
            <div className="mt-3 flex items-center gap-3 text-[10px] font-bold text-slate-400">
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-100"/>선택 가능</span>
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500"/>이미 열린 회차</span>
            </div>
        </div>
    );
};

export default function TodaySessionModal({ notice, initialView = 'overview', onClose, onChanged, onViewParticipants }) {
    const today = getKstDateString();
    const occurrenceDates = listProgramOccurrences(notice).filter(date => date >= today);
    const [sessionDate, setSessionDate] = useState(
        notice.today_session?.session_date >= today
            ? notice.today_session.session_date
            : occurrenceDates[0] || getNextProgramOccurrence(notice) || today
    );
    const configuredFields = getDailySessionFields(notice);
    const emptyFields = () => configuredFields.map(field => ({ ...field, value: '' }));
    const [session, setSession] = useState(notice.today_session || null);
    const [form, setForm] = useState({
        session_fields: emptyFields(),
        capacity: Number.isFinite(Number(notice.max_capacity)) ? Number(notice.max_capacity) : 0,
        start_time: defaultTime(notice),
        hosts: getProgramHosts(notice),
    });
    const [saving, setSaving] = useState(false);
    const [view, setView] = useState(initialView);
    const [sessions, setSessions] = useState([]);
    const [sessionsLoaded, setSessionsLoaded] = useState(false);
    const [sessionCloseError, setSessionCloseError] = useState(false);
    const [staff, setStaff] = useState([]);

    useEffect(() => {
        userApi.fetchStaff().then(setStaff).catch(error => console.error('회차 호스트 목록을 불러오지 못했습니다:', error));
    }, []);

    const loadSessions = async () => {
        let closedCount = 0;
        try {
            closedCount = await programSessionsApi.closePastSessions(notice.id);
            setSessionCloseError(false);
        } catch (error) {
            console.error('지난 회차를 종료하지 못했습니다:', error);
            setSessionCloseError(true);
        }
        const rows = await programSessionsApi.fetchManageable(notice.id);
        setSessions(rows);
        setSessionsLoaded(true);
        if (initialView === 'overview' && rows.length === 0 && occurrenceDates.length > 0) setView('edit');
        if (closedCount) {
            try { await onChanged?.(); }
            catch (refreshError) { console.error('지난 회차 종료 후 화면을 갱신하지 못했습니다:', refreshError); }
        }
        return rows;
    };
    useEffect(() => { loadSessions().catch(console.error); }, [notice.id]);

    const load = async () => {
        const current = await programSessionsApi.fetchDate(notice.id, sessionDate);
        setSession(current);
        if (current) {
            const savedFields = Array.isArray(current.session_fields) ? current.session_fields : [];
            setForm({
                session_fields: configuredFields.map(field => ({
                    ...field,
                    value: savedFields.find(saved => saved.id === field.id)?.value || '',
                })),
                capacity: current.capacity,
                start_time: sessionTime(current.starts_at, notice),
                hosts: getSavedSessionHosts(current) ?? getProgramHosts(notice),
            });
        } else {
            setForm({ session_fields: emptyFields(), capacity: Number(notice.max_capacity) || 0, start_time: defaultTime(notice), hosts: getProgramHosts(notice) });
        }
    };
    useEffect(() => { load().catch(console.error); }, [notice.id, sessionDate]);

    const save = async () => {
        if (sessionDate < getKstDateString()) return alert('지난 날짜의 회차는 다시 열 수 없습니다.');
        const missing = form.session_fields.find(field => field.required && !String(field.value || '').trim());
        if (missing) return alert(`${missing.label} 항목을 입력해주세요.`);
        setSaving(true);
        try {
            await programSessionsApi.saveSession(notice, {
                ...form,
                hosts: form.hosts.map(host => ({
                    ...host,
                    name: host.name || staff.find(member => member.id === host.host_id)?.name || '',
                })),
            }, sessionDate);
            try {
                await onChanged?.();
            } catch (refreshError) {
                console.error('오늘 회차 저장 후 화면을 갱신하지 못했습니다:', refreshError);
            }
            await loadSessions();
            setSaving(false);
            setView('overview');
        } catch (error) {
            setSaving(false);
            alert(`회차를 저장하지 못했습니다: ${error.message}`);
        }
    };
    const closeToday = async () => {
        const responses = session?.daily_program_session_responses || [];
        const hasParticipant = responses.some(response =>
            response.status === 'JOIN' || response.status === 'WAITLIST' || response.is_attended
        );
        const confirmationMessage = !hasParticipant
            ? `오늘 회차를 닫을까요?${responses.length ? `\n\n취소된 신청 기록 ${responses.length}건은 보존됩니다.` : ''}\n\n참석자가 없는 회차로 처리되어 캘린더·날짜별 명단·운영 횟수에서 제외됩니다.`
            : `오늘 회차의 신청 기록 ${responses.length}건이 있습니다. 오늘 프로그램을 닫을까요?\n\n회차와 신청 기록은 보존됩니다.`;
        if (!window.confirm(confirmationMessage)) return;
        setSaving(true);
        try {
            await programSessionsApi.closeSession(notice.id, sessionDate);
            try {
                await onChanged?.();
            } catch (refreshError) {
                console.error('오늘 회차 종료 후 화면을 갱신하지 못했습니다:', refreshError);
            }
            await loadSessions();
            setSaving(false);
            setView('overview');
        } catch (error) {
            setSaving(false);
            alert(`오늘 프로그램을 닫지 못했습니다: ${error.message}`);
        }
    };
    const participants = (session?.daily_program_session_responses || []).filter(item => ['JOIN', 'WAITLIST'].includes(item.status));

    const showParticipants = view === 'participants';
    const showOverview = view === 'overview';

    const openNewSession = () => {
        const used = new Set(sessions.map(item => item.session_date));
        const nextDate = occurrenceDates.find(date => !used.has(date));
        if (!nextDate) return;
        setSessionDate(nextDate);
        setView('edit');
    };

    return createPortal(<div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4" onClick={onClose}>
        <div
            className="scrollbar-hide w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onClick={event => event.stopPropagation()}
        >
            <div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-bold text-blue-600">{showOverview ? '회차 관리' : showParticipants ? '회차 신청자' : `${sessionDate} 회차`}</p><h2 className="mt-1 text-xl font-black text-slate-900">{notice.title}</h2></div><button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={18}/></button></div>
            <div className="space-y-4">
                {showOverview && sessionsLoaded && <>
                    {sessionCloseError && <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">지난 회차의 종료 상태를 저장하지 못했습니다. 잠시 후 다시 열어 확인해주세요.</p>}
                    <div className="space-y-3">
                        {sessions.map(item => (
                            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="flex items-center gap-2 text-base font-black text-slate-900"><CalendarDays size={17} className="text-blue-600"/>{item.session_date}</p>
                                        <p className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-500"><Clock3 size={14}/>{sessionTime(item.starts_at, notice)} · 신청 {item.join_count || 0}명 · {item.status === 'OPEN' ? '신청 중' : '마감'}</p>
                                        <p className="mt-1.5 text-xs font-bold text-slate-500">호스트: {(getSavedSessionHosts(item) ?? getProgramHosts(notice)).map(host => host.name || staff.find(member => member.id === host.host_id)?.name).filter(Boolean).join(', ') || '미지정'}</p>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => { setSessionDate(item.session_date); setView('edit'); }} className="rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-black text-slate-700">회차 정보</button>
                                    <button type="button" onClick={() => onViewParticipants ? onViewParticipants(item.session_date) : (() => { setSessionDate(item.session_date); setView('participants'); })()} className="rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white">신청자 명단</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {sessions.length === 0 && occurrenceDates.length === 0 && <p className="rounded-xl bg-slate-50 py-6 text-center text-sm font-bold text-slate-500">예정된 회차가 없습니다.</p>}
                    {occurrenceDates.some(date => !sessions.some(item => item.session_date === date)) && <button type="button" onClick={openNewSession} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 py-3.5 text-sm font-black text-blue-700"><Plus size={17}/>새 회차 열기</button>}
                </>}
                {!showOverview && !showParticipants && occurrenceDates.length > 1 && (
                    <div>
                        <span className="mb-2 block text-xs font-bold text-slate-600">신청받을 회차</span>
                        <SessionDateCalendar dates={occurrenceDates} value={sessionDate} openedDates={sessions.map(item => item.session_date)} onChange={setSessionDate}/>
                    </div>
                )}
                {!showOverview && !showParticipants && form.session_fields.map((field, index) => (
                    <label key={field.id} className="block">
                        <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-600"><FileText size={14}/>{field.label}{field.required && <span className="text-red-400">*</span>}</span>
                        <textarea value={field.value} onChange={event => setForm(previous => ({ ...previous, session_fields: previous.session_fields.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} placeholder={`${field.label} 입력`} rows="3" className="w-full resize-none rounded-xl border border-slate-200 p-4 text-sm font-bold outline-none focus:border-blue-500" />
                    </label>
                ))}
                {!showOverview && !showParticipants && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <div><p className="text-sm font-black text-slate-800">회차 호스트</p><p className="mt-1 text-[11px] font-medium text-slate-400">프로그램 기본 호스트를 불러왔어요. 이 회차에서만 변경됩니다.</p></div>
                            <button type="button" onClick={() => setForm(previous => ({ ...previous, hosts: [...previous.hosts, { host_id: '', name: '', one_liner: '' }] }))} className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-black text-white">+ 추가</button>
                        </div>
                        {form.hosts.length ? <div className="space-y-3">{form.hosts.map((host, index) => {
                            const selectedElsewhere = form.hosts.filter((_, itemIndex) => itemIndex !== index).map(item => item.host_id).filter(Boolean);
                            return <div key={`${host.host_id || 'empty'}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                <div className="flex items-center gap-2">
                                    <select value={host.host_id || ''} onChange={event => {
                                        const member = staff.find(item => item.id === event.target.value);
                                        setForm(previous => ({ ...previous, hosts: previous.hosts.map((item, itemIndex) => itemIndex === index ? { ...item, host_id: event.target.value, name: member?.name || '' } : item) }));
                                    }} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500">
                                        <option value="">호스트 선택</option>
                                        {staff.filter(member => !selectedElsewhere.includes(member.id)).map(member => <option key={member.id} value={member.id}>{member.school && member.school !== '더작은재단' ? `${member.name} (${member.school})` : member.name}</option>)}
                                    </select>
                                    <button type="button" onClick={() => setForm(previous => ({ ...previous, hosts: previous.hosts.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg bg-red-50 px-2.5 py-2 text-xs font-black text-red-500">삭제</button>
                                </div>
                                <input type="text" value={host.one_liner || ''} onChange={event => setForm(previous => ({ ...previous, hosts: previous.hosts.map((item, itemIndex) => itemIndex === index ? { ...item, one_liner: event.target.value } : item) }))} placeholder="호스트 한마디 (선택)" className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-500"/>
                            </div>;
                        })}</div> : <div className="rounded-xl border border-dashed border-slate-200 bg-white py-5 text-center text-xs font-bold text-slate-400">지정된 호스트가 없습니다. 필요하면 추가해주세요.</div>}
                    </div>
                )}
                {!showOverview && !showParticipants && <div className="grid grid-cols-2 gap-3"><label><span className="mb-1.5 block text-xs font-bold text-slate-600">시작 시간</span><input type="time" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold"/></label><label><span className="mb-1.5 block text-xs font-bold text-slate-600">정원</span><input type="number" min="0" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold"/></label></div>}
                {!showOverview && !showParticipants && <button disabled={saving} onClick={save} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-black text-white disabled:opacity-50">{session ? '회차 내용 저장' : '신청 열기'}</button>}
                {showParticipants && session && <div><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><Users size={16}/>신청자 명단</h3><span className="text-xs font-bold text-blue-600">{session.join_count || 0}명</span></div>{participants.length ? <div className="space-y-2">{participants.map(item=><div key={item.user_id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><div><p className="text-sm font-bold text-slate-800">{item.users?.name || '이름 없음'}</p><p className="text-[11px] text-slate-400">{item.status === 'WAITLIST' ? '대기 중' : item.users?.school || '학교 미등록'}</p></div>{item.status === 'JOIN' && <button onClick={async()=>{await programSessionsApi.setAttendance(session.id,item.user_id,!item.is_attended);await load();}} className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${item.is_attended?'bg-emerald-100 text-emerald-700':'bg-white text-slate-500 border border-slate-200'}`}><Check size={13}/>{item.is_attended?'출석':'출석 체크'}</button>}</div>)}</div>:<p className="rounded-xl bg-slate-50 py-6 text-center text-xs font-medium text-slate-400">아직 신청자가 없습니다.</p>}</div>}
                {showParticipants && !session && <p className="rounded-xl bg-slate-50 py-8 text-center text-xs font-medium text-slate-400">열린 오늘 회차가 없습니다.</p>}
                {!showOverview && !showParticipants && session?.status === 'OPEN' && <button disabled={saving} onClick={closeToday} className="w-full py-2 text-xs font-bold text-red-500">이 회차 닫기</button>}
                {!showOverview && !showParticipants && session?.status === 'CLOSED' && <p className="rounded-xl bg-slate-100 py-3 text-center text-xs font-bold text-slate-500">이 회차는 닫혀 있습니다. 위 내용을 저장하면 다시 열립니다.</p>}
                {!showOverview && sessions.length > 0 && <button type="button" onClick={() => setView('overview')} className="w-full py-2 text-xs font-bold text-slate-500">회차 목록으로</button>}
            </div>
        </div>
    </div>, document.body);
}
