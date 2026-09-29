import React, { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, ChevronUp, FileText, MapPin, MessageSquareText, Settings, Sparkles } from 'lucide-react';
import UserAvatar from '../../../common/UserAvatar';
import useUserJourney from './useUserJourney';
import JourneyOverview from './JourneyOverview';
import { legacyFeedbackDisplay } from '../../../../utils/programFeedbackModel';

const palette = {
    VISIT: { label: '센터 방문', dot: 'bg-sky-500', rail: 'border-l-sky-500', icon: MapPin, tint: 'bg-sky-50 text-sky-700 border-sky-100' },
    MEETING: { label: '학생 만남', dot: 'bg-violet-500', rail: 'border-l-violet-500', icon: MessageSquareText, tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    PROGRAM: { label: '프로그램', dot: 'bg-orange-500', rail: 'border-l-orange-500', icon: Sparkles, tint: 'bg-orange-50 text-orange-700 border-orange-100' },
    SURVEY: { label: '설문', dot: 'bg-slate-500', rail: 'border-l-slate-400', icon: FileText, tint: 'bg-slate-50 text-slate-700 border-slate-100' },
};

const durationLabel = minutes => minutes == null ? '계산 기록 없음' : minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
const dateLabel = date => date ? new Date(`${date}T12:00:00+09:00`).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) : '날짜 미기록';
const dateParts = date => {
    if (!date) return { primary: '날짜 미기록', year: '연도 미기록' };
    const value = new Date(`${date}T12:00:00+09:00`);
    return {
        primary: `${value.getMonth() + 1}/${value.getDate()}(${value.toLocaleDateString('ko-KR', { weekday: 'short' }).replace('요일', '')})`,
        year: `${value.getFullYear()}년`,
    };
};
const isRoutineVisitRemark = value => /^(모바일\s*QR\s*체크인|QR\s*체크인|키오스크\s*체크인)$/i.test(String(value || '').trim());
const canExpandItem = item => {
    if (item.type === 'VISIT') return Boolean(item.note?.purpose || item.note?.checkout_feedback || (item.note?.remarks && !isRoutineVisitRemark(item.note.remarks)));
    if (item.type === 'PROGRAM') return Boolean(item.feedbacks?.length);
    if (item.type === 'MEETING') return Boolean(item.log?.content);
    return item.type === 'SURVEY';
};

const answerLabel = value => {
    if (Array.isArray(value)) return value.join(', ');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return String(value ?? '').trim();
};

function ProgramFeedback({ feedback }) {
    const display = legacyFeedbackDisplay(feedback, feedback.notices);
    const answered = (display.snapshot?.questions || []).map(question => ({ question, value: display.answers?.[question.id] }))
        .filter(({ value }) => value != null && answerLabel(value));
    if (!answered.length) return <p className="text-[15px] text-slate-500">작성된 후기 내용이 없습니다.</p>;
    return <div className="space-y-3">
        {display.q3_satisfaction != null && <div className="flex items-center gap-2 text-sm font-black text-amber-600"><span aria-hidden="true">{'★'.repeat(display.q3_satisfaction)}{'☆'.repeat(5 - display.q3_satisfaction)}</span><span>{display.q3_satisfaction}/5</span></div>}
        <dl className="space-y-3">{answered.map(({ question, value }) => <div key={question.id} className="rounded-xl bg-emerald-50/70 p-3"><dt className="text-[13px] font-black text-emerald-800">{question.title}</dt><dd className="mt-1 whitespace-pre-wrap text-[15px] leading-6 text-slate-700">{answerLabel(value)}</dd></div>)}</dl>
        <p className="text-xs font-bold text-slate-500">{feedback.created_at ? new Date(feedback.created_at).toLocaleString('ko-KR') : '작성일 미기록'}</p>
    </div>;
}

function SurveyAnswers({ survey }) {
    const answers = survey.answers || {};
    const questions = survey.snapshot?.questions || [];
    const questionMap = new Map(questions.map(question => [question.id, question.title]));
    const rows = Object.entries(answers).filter(([, value]) => value != null && answerLabel(value));
    if (!rows.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-400">표시할 응답 내용이 없습니다.</p>;
    return <dl className="space-y-3">{rows.map(([key, value], index) => <div key={key} className="rounded-xl bg-slate-50 p-4">
        <dt className="text-[13px] font-black text-slate-600">{questionMap.get(key) || (rows.length === 1 ? '응답' : `응답 ${index + 1}`)}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-[15px] font-bold leading-6 text-slate-700">{answerLabel(value)}</dd>
    </div>)}</dl>;
}

function TimelineDetail({ item }) {
    if (item.type === 'VISIT') return (
        <div className="grid gap-2 text-[15px] text-slate-600 sm:grid-cols-2">
            <p><strong className="text-slate-800">이용 공간</strong><br />{item.session.usedSpaces || '미기록'}</p>
            <p><strong className="text-slate-800">체류시간</strong><br />{item.session.durationMin}</p>
            {item.session.isAutoCheckedOut && <p className="sm:col-span-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">퇴실 기록이 없어 22:00에 자동 마감된 방문입니다. 평균 체류시간에서는 제외됩니다.</p>}
            {(item.note?.purpose || item.note?.remarks || item.note?.checkout_feedback) && <div className="sm:col-span-2 rounded-xl bg-slate-50 p-3 leading-relaxed">
                {item.note.purpose && <p><strong>방문 목적</strong> · {item.note.purpose}</p>}
                {item.note.remarks && <p className="mt-1"><strong>방문 메모</strong> · {item.note.remarks}</p>}
                {item.note.checkout_feedback && <p className="mt-1"><strong>퇴실 응답</strong> · {item.note.checkout_feedback}</p>}
            </div>}
        </div>
    );
    if (item.type === 'MEETING') return <div className="space-y-2 text-[15px] text-slate-600">
        <div className="whitespace-pre-wrap rounded-xl bg-violet-50/60 p-4 leading-6 text-slate-700">{item.log.content || '기록 내용이 없습니다.'}</div>
        <p className="text-[13px] text-slate-500">실제 만남일 기준 · 기록 작성 {item.log.created_at ? new Date(item.log.created_at).toLocaleDateString('ko-KR') : '미기록'}</p>
    </div>;
    if (item.type === 'PROGRAM') return <div className="space-y-4">
        <p className="text-[15px] font-bold text-slate-600">{item.event.kind}에 실제 출석한 기록입니다.</p>
        {item.feedbacks?.length ? <div className="border-t border-slate-100 pt-4"><h5 className="mb-3 text-sm font-black text-slate-800">작성한 프로그램 후기</h5><div className="space-y-4">{item.feedbacks.map(feedback => <ProgramFeedback key={feedback.id} feedback={feedback} />)}</div></div> : <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-400">작성한 후기가 없습니다.</p>}
    </div>;
    if (item.type === 'SURVEY') return <SurveyAnswers survey={item.survey} />;
    return <p className="text-sm text-slate-600">{item.summary}</p>;
}

export default function UserJourneyView({ user, allUsers = [], locations, schoolLogs, visitNotes, feedbacks, checkoutSurveyEntries, onBack, onManageAccount }) {
    const [filter, setFilter] = useState('ALL');
    const [expanded, setExpanded] = useState(new Set());
    const journey = useUserJourney({ user, locations, schoolLogs, visitNotes, feedbacks, checkoutSurveyEntries });
    const filteredTimeline = useMemo(() => filter === 'ALL' ? journey.timeline : journey.timeline.filter(item => item.type === filter), [journey.timeline, filter]);
    const groupedTimeline = useMemo(() => filteredTimeline.reduce((groups, item) => {
        const latestGroup = groups[groups.length - 1];
        if (latestGroup?.date === item.date) latestGroup.items.push(item);
        else groups.push({ date: item.date, items: [item] });
        return groups;
    }, []), [filteredTimeline]);
    const latestVisit = journey.sessions.reduce((latest, session) => !latest || session.date > latest ? session.date : latest, '');
    const profileDetails = [
        user.phone || user.phone_back4 ? ['연락처', user.phone || user.phone_back4] : null,
        user.guardian_name ? ['보호자', user.guardian_name] : null,
        user.guardian_phone ? ['보호자 연락처', user.guardian_phone] : null,
        (user.guardian_name || user.guardian_phone) && user.guardian_relation ? ['관계', user.guardian_relation] : null,
    ].filter(Boolean);

    const toggle = id => setExpanded(current => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    return <div className="animate-fade-in-up space-y-5">
        <section className="overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 md:px-7">
                <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-700"><ArrowLeft size={17} /> 이용자 목록</button>
                <button type="button" onClick={onManageAccount} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900"><Settings size={16} /> 계정 관리</button>
            </div>
            <div className="p-5 md:px-7 md:py-6">
                <div className="flex min-w-0 items-start gap-4 md:items-center">
                    <UserAvatar user={user} size="w-14 h-14 md:w-16 md:h-16" textSize="text-lg" />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><h2 className="text-xl font-black text-gray-950 md:text-2xl">{user.name}</h2><span className="text-[13px] font-bold text-blue-600">{user.user_group || '그룹 미지정'}</span></div>
                        <p className="mt-0.5 text-[14px] font-semibold text-gray-600">{user.schoolDisplayName || user.school || '학교 미지정'}{user.church ? ` · ${user.church}` : ''}</p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
                            <p className="text-gray-500"><span className="font-medium text-gray-400">최근 방문</span> <span className="font-semibold">{latestVisit ? dateLabel(latestVisit) : '기록 없음'}</span></p>
                            {profileDetails.map(([label, value]) => <p key={label} className="text-gray-700"><span className="font-medium text-gray-400">{label}</span> <span className="font-semibold">{value}</span></p>)}
                        </div>
                    </div>
                </div>
                {user.memo && <div className="mt-5 border-t border-gray-100 pt-4"><span className="text-xs font-bold text-gray-400">관리자 메모</span><p className="mt-1 whitespace-pre-wrap text-[14px] leading-6 text-gray-600">{user.memo}</p></div>}
            </div>
            <dl className="grid grid-cols-2 border-t border-gray-100 bg-gray-50/60 md:grid-cols-4">
                {[['센터 방문', `${journey.sessions.length}회`], ['프로그램 참여', `${journey.programEvents.length}회`], ['학생 만남', `${journey.meetingLogs.length}회`], ['평균 체류시간', durationLabel(journey.averageMinutes)]].map(([label, value], index) => <div key={label} className={`px-5 py-3.5 md:px-6 ${index % 2 ? 'border-l border-gray-100' : ''} ${index >= 2 ? 'border-t border-gray-100 md:border-t-0 md:border-l' : ''}`}><dt className="text-[12px] font-bold text-gray-500">{label}</dt><dd className="mt-0.5 text-lg font-black tracking-tight text-gray-950">{value}</dd></div>)}
            </dl>
        </section>

        {!journey.loading && !journey.error && <JourneyOverview journey={journey} />}

        <section className="overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm">
                <header className="border-b border-gray-200 px-5 pt-5 md:px-7 md:pt-6">
                    <div><h3 className="text-xl font-black text-gray-950">전체 활동 기록</h3><p className="mt-1 text-sm text-gray-500">실제 활동일을 기준으로 최신 기록부터 표시합니다.</p></div>
                    <div className="mt-4 flex gap-1 overflow-x-auto">{[['ALL', '전체'], ['VISIT', '센터 방문'], ['MEETING', '학생 만남'], ['PROGRAM', '프로그램'], ['SURVEY', '설문']].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-bold ${filter === value ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>{label}</button>)}</div>
                </header>

                {journey.loading ? <div className="py-20 text-center text-sm font-bold text-blue-600">이용자의 전체 기록을 모으고 있습니다…</div> : journey.error ? <div className="m-6 rounded-xl bg-rose-50 p-5 text-sm font-bold text-rose-700">{journey.error}</div> : filteredTimeline.length === 0 ? <div className="py-20 text-center"><CalendarDays className="mx-auto text-gray-300" size={32} /><p className="mt-3 font-bold text-gray-500">표시할 활동 기록이 없습니다.</p></div> : <div>
                    {groupedTimeline.map((group, groupIndex) => {
                        const groupDate = dateParts(group.date);
                        const previousYear = groupIndex > 0 ? dateParts(groupedTimeline[groupIndex - 1].date).year : null;
                        const showYear = groupIndex === 0 || previousYear !== groupDate.year;
                        return <React.Fragment key={group.date}>
                        <section className={`border-b border-gray-200 last:border-b-0 md:grid md:grid-cols-[116px_minmax(0,1fr)] ${showYear && groupIndex > 0 ? 'border-t-2 border-t-gray-300' : ''}`}>
                        <div className="flex items-baseline gap-2 border-b border-gray-100 bg-gray-50/80 px-4 py-3 md:block md:border-b-0 md:border-r md:px-5 md:py-3.5">
                            {showYear && <span className="text-[11px] font-black text-blue-600 md:mb-1.5 md:block">{groupDate.year.replace('년', '')}</span>}
                            <time className="block whitespace-nowrap text-[15px] font-black text-gray-800">{groupDate.primary}</time>
                        </div>
                        <div className="divide-y divide-gray-100">{group.items.map(item => {
                            const style = palette[item.type];
                            const Icon = style.icon;
                            const isOpen = expanded.has(item.id);
                            const canExpand = canExpandItem(item);
                            return <article key={item.id} className={`border-l-4 bg-white ${style.rail} md:border-l-0`}>
                                <button type="button" disabled={!canExpand} onClick={() => canExpand && toggle(item.id)} className={`w-full px-4 py-3.5 text-left md:px-5 md:py-3 ${canExpand ? 'hover:bg-gray-50' : 'cursor-default'}`}>
                                    <div className="flex items-start gap-3">
                                        <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${style.tint}`} title={style.label}><Icon size={14} /><span className="sr-only">{style.label}</span></span>
                                        <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h4 className="text-[16px] font-black leading-6 text-gray-950">{item.title}</h4>{item.summary && <p className="mt-1 text-[14px] leading-5 text-gray-600">{item.summary}</p>}</div>{canExpand && (isOpen ? <ChevronUp className="mt-1 shrink-0 text-gray-400" size={18} /> : <ChevronDown className="mt-1 shrink-0 text-gray-400" size={18} />)}</div></div>
                                    </div>
                                    {item.type === 'MEETING' && <dl className="ml-0 mt-3 grid gap-x-6 gap-y-2 border-t border-gray-100 pt-3 text-[14px] sm:ml-10 sm:grid-cols-2"><div><dt className="inline font-bold text-gray-400">작성자</dt><dd className="ml-2 inline font-bold text-gray-700">{item.log.users?.name || '확인되지 않음'}</dd></div><div><dt className="inline font-bold text-gray-400">학생</dt><dd className="ml-2 inline font-bold text-gray-700">{(item.log.participant_ids || []).map(id => allUsers.find(person => person.id === id)?.name).filter(Boolean).join(', ') || '확인되지 않음'}</dd></div><div><dt className="inline font-bold text-gray-400">시간</dt><dd className="ml-2 inline font-bold text-gray-700">{item.log.time_range || '미입력'}</dd></div><div><dt className="inline font-bold text-gray-400">장소</dt><dd className="ml-2 inline font-bold text-gray-700">{item.log.location || '미입력'}</dd></div></dl>}
                                    {isOpen && <div className="mt-4 border-t border-gray-100 bg-gray-50/60 p-4"><TimelineDetail item={item} /></div>}
                                </button>
                            </article>;
                        })}</div>
                    </section></React.Fragment>})}
                </div>}
        </section>
    </div>;
}
