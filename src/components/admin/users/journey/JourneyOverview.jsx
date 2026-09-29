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
    const date = value instanceof Date ? value : toDate(value);
    return date ? date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) : '날짜 미기록';
};
const makeMonth = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const elapsedLabel = (start, end) => {
    let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
    if (end.getDate() < start.getDate()) months -= 1;
    if (months <= 0) {
        const days = Math.max(0, Math.floor((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000));
        return days === 0 ? '오늘 시작' : `${days}일`;
    }
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return [years ? `${years}년` : '', remainingMonths ? `${remainingMonths}개월` : ''].filter(Boolean).join(' ');
};

function buildOverview(journey) {
    const now = new Date();
    const todayKey = `${makeMonth(now)}-${String(now.getDate()).padStart(2, '0')}`;
    const recorded = journey.timeline.filter(item => toDate(item.date) && String(item.date).slice(0, 10) <= todayKey);
    const meaningful = recorded.filter(item => ['VISIT', 'PROGRAM', 'MEETING'].includes(item.type));
    const firstDate = recorded.reduce((earliest, item) => {
        const date = toDate(item.date);
        return !earliest || date < earliest ? date : earliest;
    }, null);
    const monthCount = firstDate ? (now.getFullYear() - firstDate.getFullYear()) * 12 + now.getMonth() - firstDate.getMonth() + 1 : 0;
    const months = Array.from({ length: monthCount }, (_, index) => {
        const date = new Date(firstDate.getFullYear(), firstDate.getMonth() + index, 1);
        const key = makeMonth(date);
        const counts = { VISIT: 0, PROGRAM: 0, MEETING: 0 };
        meaningful.forEach(item => { if (monthKey(item.date) === key) counts[item.type] += 1; });
        return { key, date, counts, total: counts.VISIT + counts.PROGRAM + counts.MEETING };
    });
    const granularity = monthCount <= 24 ? 'month' : monthCount <= 48 ? 'quarter' : 'year';
    const periods = months.reduce((result, month) => {
        const year = month.date.getFullYear();
        const quarter = Math.floor(month.date.getMonth() / 3) + 1;
        const key = granularity === 'month' ? month.key : granularity === 'quarter' ? `${year}-Q${quarter}` : String(year);
        let period = result[result.length - 1];
        if (period?.key !== key) {
            period = { key, year, start: month.date, end: month.date, counts: { VISIT: 0, PROGRAM: 0, MEETING: 0 }, total: 0,
                label: granularity === 'month' ? `${month.date.getMonth() + 1}월` : granularity === 'quarter' ? `${quarter}분기` : `${year}년` };
            result.push(period);
        }
        period.end = month.date;
        period.total += month.total;
        activityTypes.forEach(type => { period.counts[type.key] += month.counts[type.key]; });
        return result;
    }, []);

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
        periods,
        granularity,
        firstDate,
        elapsed: firstDate ? elapsedLabel(firstDate, now) : '',
        hasPlottedActivity: meaningful.length > 0,
        comparisons,
        maxTotal: Math.max(...periods.map(period => period.total), 1),
        milestones: milestones.sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-6),
        hasActivity: recorded.length > 0,
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

    return <section className="overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-5 md:px-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-gray-950"><Footprints size={20} className="text-blue-600" /><h3 className="text-xl font-black">활동의 흐름</h3></div>
                    <p className="mt-1 text-[15px] text-slate-600">첫 기록 {shortDate(overview.firstDate)}부터 오늘까지 <strong className="font-bold text-slate-800">{overview.elapsed}</strong>의 기록입니다.</p>
                </div>
                <div className="flex flex-wrap gap-4 text-[13px] font-bold text-slate-600">
                    {activityTypes.map(type => <span key={type.key} className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-full ${type.color}`} />{type.label}</span>)}
                </div>
            </div>
        </div>

        <div className="px-5 pb-5 pt-6 md:px-7 md:pb-6 md:pt-7">
                {overview.hasPlottedActivity ? <div className="mx-auto max-w-[960px] overflow-x-auto pb-2">
                    <div className="flex min-w-full items-end gap-2.5" style={{ width: '100%', minWidth: overview.periods.length * 64 }} role="img" aria-label={`첫 기록부터 오늘까지 센터 방문, 프로그램 참여, 학생 만남 ${overview.granularity === 'month' ? '월별' : overview.granularity === 'quarter' ? '분기별' : '연도별'} 그래프`}>
                        {overview.periods.map((period, index) => {
                            const height = period.total ? Math.max(20, Math.round((period.total / overview.maxTotal) * 92)) : 4;
                            const showYear = overview.granularity !== 'year' && (index === 0 || overview.periods[index - 1].year !== period.year);
                            const periodTitle = overview.granularity === 'month' ? `${period.year}년 ${period.start.getMonth() + 1}월` : overview.granularity === 'quarter' ? `${period.year}년 ${period.label}` : period.label;
                            return <div key={period.key} className="flex min-w-[54px] flex-1 flex-col items-center">
                                <div className="mb-2 h-4 text-xs font-black text-slate-600">{period.total || ''}</div>
                                <div className="flex h-24 w-full items-end justify-center border-b border-gray-200 pt-1.5" title={`${periodTitle} · 방문 ${period.counts.VISIT}회, 프로그램 ${period.counts.PROGRAM}회, 학생 만남 ${period.counts.MEETING}회`}>
                                    <div className="flex w-10 flex-col-reverse overflow-hidden rounded-t-md" style={{ height }}>
                                        {activityTypes.map(type => period.counts[type.key] > 0 && <div key={type.key} className={`${type.color} min-h-[5px]`} style={{ flex: period.counts[type.key] }} />)}
                                        {!period.total && <div className="h-1 w-full bg-slate-200" />}
                                    </div>
                                </div>
                                <span className={`mt-2 text-xs font-bold ${index === overview.periods.length - 1 ? 'text-slate-900' : 'text-slate-500'}`}>{period.label}</span>
                                <span className="mt-0.5 h-4 text-[11px] font-semibold text-slate-500">{showYear ? `${period.year}년` : ''}</span>
                            </div>;
                        })}
                    </div>
                </div> : <p className="py-10 text-center text-[15px] text-slate-500">아직 센터 방문, 프로그램 참여 또는 학생 만남 기록이 없습니다.</p>}
                {overview.hasPlottedActivity && <p className="mx-auto mt-2 max-w-[960px] text-[13px] leading-5 text-slate-500">{overview.granularity === 'month' ? '월별' : overview.granularity === 'quarter' ? '분기별' : '연도별'} 활동량입니다. 색은 활동 유형을 나타냅니다.</p>}
        </div>

        {overview.hasPlottedActivity && <div className="border-t border-gray-200 px-5 py-4 md:px-7">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><h4 className="text-[15px] font-black text-slate-900">최근 3개월 변화</h4><p className="text-[13px] text-slate-500">직전 3개월과 비교</p></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-0">
                {overview.comparisons.map(item => <div key={item.key} className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:border-t-0 sm:border-l sm:px-4 sm:pt-0 sm:first:border-l-0 sm:first:pl-0 sm:last:pr-0">
                    <div><span className={`text-[14px] font-bold ${item.text}`}>{item.label}</span><p className="mt-0.5 text-[13px] text-slate-600">{item.previous}회 → {item.recent}회</p></div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-black ${item.delta > 0 ? 'bg-emerald-50 text-emerald-700' : item.delta < 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}><ChangeIcon delta={item.delta} />{item.delta > 0 ? `+${item.delta}` : item.delta}</span>
                </div>)}
                </div>
        </div>}

        {overview.milestones.length > 0 && <div className="border-t border-gray-200 px-5 py-5 md:px-7">
            <div className="mb-4 flex items-center gap-2"><Flag size={16} className="text-slate-500" /><h4 className="text-sm font-black text-slate-800">주요 이정표</h4></div>
            <div className="flex gap-3 overflow-x-auto pb-1">
                {overview.milestones.map((milestone, index) => <div key={`${milestone.title}:${milestone.date}:${index}`} className="min-w-[190px] flex-1 border-l-2 border-gray-200 pl-3 first:border-blue-500">
                    <time className="text-xs font-bold text-slate-500">{shortDate(milestone.date)}</time>
                    <p className="mt-1 text-[15px] font-black text-slate-800">{milestone.title}</p>
                    <p className="mt-0.5 truncate text-[13px] text-slate-500">{milestone.detail}</p>
                </div>)}
            </div>
        </div>}
    </section>;
}
