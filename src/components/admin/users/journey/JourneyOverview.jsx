import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Flag, Footprints } from 'lucide-react';

const activityTypes = [
    { key: 'VISIT', label: '센터 방문', color: 'bg-sky-500', text: 'text-sky-700' },
    { key: 'PROGRAM', label: '프로그램', color: 'bg-orange-400', text: 'text-orange-700' },
    { key: 'MEETING', label: '학생 만남', color: 'bg-violet-500', text: 'text-violet-700' },
];

const monthKey = date => String(date || '').slice(0, 7);
const toDate = value => {
    const date = new Date(`${String(value || '').slice(0, 10)}T12:00:00+09:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};
const shortDate = value => {
    const date = toDate(value);
    return date ? date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) : '날짜 미기록';
};
const makeMonth = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

function buildOverview(journey) {
    const meaningful = journey.timeline.filter(item => ['VISIT', 'PROGRAM', 'MEETING'].includes(item.type) && toDate(item.date));
    const newestDate = meaningful.reduce((latest, item) => {
        const date = toDate(item.date);
        return !latest || date > latest ? date : latest;
    }, null);
    const now = new Date();
    const anchor = newestDate && newestDate > now ? newestDate : now;
    const months = Array.from({ length: 12 }, (_, index) => {
        const date = new Date(anchor.getFullYear(), anchor.getMonth() - (11 - index), 1);
        const key = makeMonth(date);
        const counts = { VISIT: 0, PROGRAM: 0, MEETING: 0 };
        meaningful.forEach(item => { if (monthKey(item.date) === key) counts[item.type] += 1; });
        return { key, date, counts, total: counts.VISIT + counts.PROGRAM + counts.MEETING };
    });

    const sumRange = range => activityTypes.reduce((result, type) => ({
        ...result,
        [type.key]: range.reduce((sum, month) => sum + month.counts[type.key], 0),
    }), {});
    const recent = sumRange(months.slice(-3));
    const previous = sumRange(months.slice(-6, -3));
    const comparisons = activityTypes.map(type => ({ ...type, recent: recent[type.key], previous: previous[type.key], delta: recent[type.key] - previous[type.key] }));

    const ascending = [...meaningful].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const firstOf = type => ascending.find(item => item.type === type);
    const milestones = [];
    const firstVisit = firstOf('VISIT');
    const firstProgram = firstOf('PROGRAM');
    const firstMeeting = firstOf('MEETING');
    if (firstVisit) milestones.push({ date: firstVisit.date, title: '첫 센터 방문', detail: firstVisit.title });
    if (firstProgram) milestones.push({ date: firstProgram.date, title: '첫 프로그램 참여', detail: firstProgram.title });
    if (firstMeeting) milestones.push({ date: firstMeeting.date, title: '첫 학생 만남', detail: '관계 기록 시작' });

    const visits = ascending.filter(item => item.type === 'VISIT');
    if (visits[9]) milestones.push({ date: visits[9].date, title: '10번째 센터 방문', detail: '누적 방문 10회' });
    for (let index = 1; index < visits.length; index += 1) {
        const before = toDate(visits[index - 1].date);
        const current = toDate(visits[index].date);
        const gap = Math.round((current - before) / 86400000);
        if (gap >= 30) milestones.push({ date: visits[index].date, title: '다시 센터를 찾음', detail: `${gap}일 만의 방문` });
    }

    return {
        months,
        comparisons,
        maxTotal: Math.max(...months.map(month => month.total), 1),
        milestones: milestones.sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-6),
        hasActivity: meaningful.length > 0,
    };
}

function ChangeIcon({ delta }) {
    if (delta > 0) return <ArrowUpRight size={17} />;
    if (delta < 0) return <ArrowDownRight size={17} />;
    return <ArrowRight size={17} />;
}

export default function JourneyOverview({ journey }) {
    const overview = useMemo(() => buildOverview(journey), [journey.timeline]);
    if (!overview.hasActivity) return null;

    return <section className="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-5 md:px-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-slate-900"><Footprints size={20} className="text-sky-600" /><h3 className="text-xl font-black">활동의 흐름</h3></div>
                    <p className="mt-1 text-[15px] text-slate-500">지난 12개월의 활동 리듬과 최근 변화를 함께 봅니다.</p>
                </div>
                <div className="flex flex-wrap gap-4 text-[13px] font-bold text-slate-600">
                    {activityTypes.map(type => <span key={type.key} className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-full ${type.color}`} />{type.label}</span>)}
                </div>
            </div>
        </div>

        <div className="grid xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.85fr)]">
            <div className="min-w-0 border-b border-gray-100 p-5 md:p-7 xl:border-b-0 xl:border-r">
                <div className="overflow-x-auto pb-2">
                    <div className="flex min-w-[690px] items-end gap-3" role="img" aria-label="최근 12개월 센터 방문, 프로그램 참여, 학생 만남 월별 그래프">
                        {overview.months.map((month, index) => {
            const height = month.total ? Math.max(20, Math.round((month.total / overview.maxTotal) * 92)) : 4;
                            return <div key={month.key} className="flex min-w-0 flex-1 flex-col items-center">
                                <div className="mb-2 h-4 text-xs font-black text-slate-600">{month.total || ''}</div>
                                <div className="flex h-24 w-full items-end border-b border-gray-200 px-1.5 pt-1.5" title={`${month.date.getFullYear()}년 ${month.date.getMonth() + 1}월 · 방문 ${month.counts.VISIT}회, 프로그램 ${month.counts.PROGRAM}회, 학생 만남 ${month.counts.MEETING}회`}>
                                    <div className="flex w-full flex-col-reverse overflow-hidden rounded-lg" style={{ height }}>
                                        {activityTypes.map(type => month.counts[type.key] > 0 && <div key={type.key} className={`${type.color} min-h-[5px]`} style={{ flex: month.counts[type.key] }} />)}
                                        {!month.total && <div className="h-1 w-full bg-slate-200" />}
                                    </div>
                                </div>
                                <span className={`mt-2 text-xs font-bold ${index === overview.months.length - 1 ? 'text-slate-900' : 'text-slate-500'}`}>{month.date.getMonth() + 1}월</span>
                            </div>;
                        })}
                    </div>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-slate-500">막대 높이는 그달의 전체 활동량, 색의 비율은 활동 구성을 나타냅니다.</p>
            </div>

            <div className="p-5 md:p-7">
                <h4 className="text-base font-black text-slate-900">최근 3개월 변화</h4>
                <p className="mt-1 text-[13px] text-slate-500">직전 3개월과 비교</p>
                <div className="mt-4 divide-y divide-slate-100">
                    {overview.comparisons.map(item => <div key={item.key} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div><span className={`text-[13px] font-black ${item.text}`}>{item.label}</span><p className="mt-0.5 text-[13px] text-slate-500">{item.previous}회 → {item.recent}회</p></div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-black ${item.delta > 0 ? 'bg-emerald-50 text-emerald-700' : item.delta < 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}><ChangeIcon delta={item.delta} />{item.delta > 0 ? `+${item.delta}` : item.delta}</span>
                    </div>)}
                </div>
            </div>
        </div>

        {overview.milestones.length > 0 && <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4 md:px-7">
            <div className="mb-4 flex items-center gap-2"><Flag size={16} className="text-slate-500" /><h4 className="text-sm font-black text-slate-800">주요 이정표</h4></div>
            <div className="flex gap-3 overflow-x-auto pb-1">
                {overview.milestones.map((milestone, index) => <div key={`${milestone.title}:${milestone.date}:${index}`} className="min-w-[190px] flex-1 border-l-2 border-slate-300 pl-3">
                    <time className="text-xs font-bold text-slate-500">{shortDate(milestone.date)}</time>
                    <p className="mt-1 text-[15px] font-black text-slate-800">{milestone.title}</p>
                    <p className="mt-0.5 truncate text-[13px] text-slate-500">{milestone.detail}</p>
                </div>)}
            </div>
        </div>}
    </section>;
}
