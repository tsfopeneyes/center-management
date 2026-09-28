import React, { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, ChevronUp, Clock3, FileText, MapPin, MessageSquareText, Settings, Sparkles } from 'lucide-react';
import UserAvatar from '../../../common/UserAvatar';
import useUserJourney from './useUserJourney';
import JourneyOverview from './JourneyOverview';
import { legacyFeedbackDisplay } from '../../../../utils/programFeedbackModel';

const palette = {
    VISIT: { label: '센터 방문', dot: 'bg-sky-500', icon: MapPin, tint: 'bg-sky-50 text-sky-700 border-sky-100' },
    MEETING: { label: '학생 만남', dot: 'bg-violet-500', icon: MessageSquareText, tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    PROGRAM: { label: '프로그램', dot: 'bg-orange-500', icon: Sparkles, tint: 'bg-orange-50 text-orange-700 border-orange-100' },
    SURVEY: { label: '설문', dot: 'bg-slate-500', icon: FileText, tint: 'bg-slate-50 text-slate-700 border-slate-100' },
};

const durationLabel = minutes => minutes == null ? '계산 기록 없음' : minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
const dateLabel = date => date ? new Date(`${date}T12:00:00+09:00`).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) : '날짜 미기록';
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
    const latestVisit = journey.sessions.reduce((latest, session) => !latest || session.date > latest ? session.date : latest, '');

    const toggle = id => setExpanded(current => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    return <div className="animate-fade-in-up space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-600 transition hover:border-blue-200 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"><ArrowLeft size={17} /> 이용자 목록</button>
            <button type="button" onClick={onManageAccount} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-100"><Settings size={17} /> 계정 관리</button>
        </div>

        <section className="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm">
            <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:p-6">
                <div className="flex min-w-0 items-center gap-4">
                    <UserAvatar user={user} size="w-16 h-16" textSize="text-lg" />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black tracking-tight text-gray-950 md:text-[28px]">{user.name}</h2><span className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">{user.user_group || '그룹 미지정'}</span></div>
                        <p className="mt-1.5 truncate text-sm font-bold text-gray-500">{user.schoolDisplayName || user.school || '학교 미지정'}{user.church ? ` · ${user.church}` : ''}</p>
                        <p className="mt-2.5 inline-flex rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-gray-500">최근 방문&nbsp; <strong className="text-gray-800">{latestVisit ? dateLabel(latestVisit) : '기록 없음'}</strong></p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-2xl bg-gray-50/80 px-5 py-4 text-sm md:min-w-[320px]">
                    <p><span className="block text-xs font-bold text-gray-500">연락처</span><strong className="mt-0.5 block text-[15px] text-gray-800">{user.phone || user.phone_back4 || '-'}</strong></p>
                    <p><span className="block text-xs font-bold text-gray-500">보호자</span><strong className="mt-0.5 block text-[15px] text-gray-800">{user.guardian_name || '-'}</strong></p>
                    <p><span className="block text-xs font-bold text-gray-500">보호자 연락처</span><strong className="mt-0.5 block text-[15px] text-gray-800">{user.guardian_phone || '-'}</strong></p>
                    <p><span className="block text-xs font-bold text-gray-500">관계</span><strong className="mt-0.5 block text-[15px] text-gray-800">{user.guardian_relation || '-'}</strong></p>
                </div>
            </div>
            <div className="mx-5 mb-5 grid grid-cols-2 divide-x divide-y divide-gray-200 overflow-hidden rounded-2xl bg-gray-50 md:mx-6 md:mb-6 md:grid-cols-4 md:divide-y-0">
                {[['센터 방문', `${journey.sessions.length}회`, 'text-sky-700'], ['프로그램 참여', `${journey.programEvents.length}회`, 'text-orange-700'], ['학생 만남', `${journey.meetingLogs.length}회`, 'text-violet-700'], ['평균 체류시간', durationLabel(journey.averageMinutes), 'text-gray-900']].map(([label, value, color]) => <div key={label} className="px-5 py-3.5"><span className="block text-xs font-bold text-gray-500">{label}</span><strong className={`mt-1 block text-xl font-black ${color}`}>{value}</strong></div>)}
            </div>
        </section>

        {!journey.loading && !journey.error && <JourneyOverview journey={journey} />}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
            <section className="rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm md:p-6">
                <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
                    <div><h3 className="text-xl font-black text-gray-900">전체 활동 기록</h3><p className="mt-1 text-[15px] text-gray-500">필요한 기록을 활동 유형별로 찾아볼 수 있습니다.</p></div>
                    <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
                        {[['ALL', '전체'], ['VISIT', '방문'], ['MEETING', '학생 만남'], ['PROGRAM', '프로그램'], ['SURVEY', '설문']].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`shrink-0 rounded-lg px-3 py-2 text-[13px] font-black ${filter === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>)}
                    </div>
                </div>

                {journey.loading ? <div className="py-16 text-center text-sm font-bold text-sky-600">이용자의 전체 기록을 모으고 있습니다…</div> : journey.error ? <div className="rounded-2xl bg-rose-50 p-5 text-sm font-bold text-rose-700">{journey.error}</div> : filteredTimeline.length === 0 ? <div className="py-16 text-center"><CalendarDays className="mx-auto text-slate-300" size={32} /><p className="mt-3 font-bold text-slate-500">표시할 활동 기록이 없습니다.</p></div> : <div className="relative ml-2 border-l border-slate-200 pl-6">
                    {filteredTimeline.map(item => {
                        const style = palette[item.type];
                        const Icon = style.icon;
                        const isOpen = expanded.has(item.id);
                        const canExpand = canExpandItem(item);
                        return <article key={item.id} className="relative pb-4 last:pb-0">
                            <span className={`absolute -left-[29px] top-3 h-2.5 w-2.5 rounded-full ring-4 ring-white ${style.dot}`} />
                            <button type="button" disabled={!canExpand} onClick={() => canExpand && toggle(item.id)} className={`w-full rounded-2xl border border-gray-100 bg-gray-50/60 p-4 text-left transition-colors ${canExpand ? 'hover:border-blue-100 hover:bg-white' : 'cursor-default'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-black ${style.tint}`}><Icon size={13} />{style.label}</span><time className="text-[13px] font-bold text-slate-500">{dateLabel(item.date)}</time></div><h4 className="mt-2 truncate text-base font-black text-slate-900">{item.title}</h4>{item.summary && <p className="mt-1 text-[15px] text-slate-600">{item.summary}</p>}</div>
                                    {canExpand && (isOpen ? <ChevronUp className="shrink-0 text-slate-400" size={18} /> : <ChevronDown className="shrink-0 text-slate-400" size={18} />)}
                                </div>
                                {item.type === 'MEETING' && <div className="mt-3 grid gap-2 rounded-xl bg-violet-50/50 p-3.5 text-[14px] sm:grid-cols-2">
                                    <p><span className="font-bold text-violet-500">작성자</span><strong className="ml-2 text-slate-700">{item.log.users?.name || '확인되지 않음'}</strong></p>
                                    <p><span className="font-bold text-violet-500">학생</span><strong className="ml-2 text-slate-700">{(item.log.participant_ids || []).map(id => allUsers.find(person => person.id === id)?.name).filter(Boolean).join(', ') || '확인되지 않음'}</strong></p>
                                    <p><span className="font-bold text-violet-500">시간</span><strong className="ml-2 text-slate-700">{item.log.time_range || '미입력'}</strong></p>
                                    <p><span className="font-bold text-violet-500">장소</span><strong className="ml-2 text-slate-700">{item.log.location || '미입력'}</strong></p>
                                </div>}
                                {isOpen && <div className="mt-4 border-t border-slate-100 pt-4"><TimelineDetail item={item} /></div>}
                            </button>
                        </article>;
                    })}
                </div>}
            </section>

            <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
                <div className="rounded-[20px] border border-gray-100 bg-white p-5 shadow-sm"><h3 className="text-base font-black text-gray-800">관리자 메모</h3><p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-gray-600">{user.memo || '등록된 관리자 메모가 없습니다.'}</p></div>
                <div className="rounded-[20px] border border-blue-100 bg-blue-50/60 p-5"><div className="flex items-center gap-2 text-base font-black text-blue-900"><Clock3 size={17} /> 집계 기준</div><p className="mt-2 text-[13px] leading-6 text-blue-800">프로그램은 실제 출석한 회차마다 1회로 계산합니다. 자동 마감과 진행 중 방문은 평균 체류시간에서 제외합니다.</p></div>
            </aside>
        </div>
    </div>;
}
