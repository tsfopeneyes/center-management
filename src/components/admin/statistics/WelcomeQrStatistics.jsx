import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { format, endOfMonth, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';
import { supabase } from '../../../supabaseClient';
import { getQrStatisticsRange } from './qrStatisticsRange';

export default function WelcomeQrStatistics({ hookData }) {
    const { selectedYear, selectedMonth, selectedDay, periodType } = hookData;
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [revision, setRevision] = useState(0);
    const range = useMemo(() => getQrStatisticsRange(selectedYear, selectedMonth, selectedDay, periodType),
        [selectedYear, selectedMonth, selectedDay, periodType]);
    useEffect(() => {
        let active = true;
        setLoading(true); setError(''); setData(null);
        const buckets = (periodType === 'YEARLY' ? eachMonthOfInterval(range) : eachDayOfInterval(range)).map(date => ({
            start: format(date, 'yyyy-MM-dd'),
            end: format(periodType === 'YEARLY' ? endOfMonth(date) : date, 'yyyy-MM-dd'),
            label: format(date, periodType === 'YEARLY' ? 'M월' : 'M/d'),
        }));
        Promise.all(buckets.map(bucket => supabase.from('welcome_qr_visits')
            .select('*', { count: 'exact', head: true }).gte('visit_day', bucket.start).lte('visit_day', bucket.end)))
            .then(results => {
                if (!active) return;
                if (results.some(result => result.error)) throw new Error('query');
                const points = buckets.map((bucket, i) => ({ ...bucket, count: results[i].count || 0 }));
                setData({ points, total: points.reduce((sum, point) => sum + point.count, 0) });
            }).catch(() => { if (active) setError('방문 집계를 불러오지 못했습니다. 다시 시도해 주세요.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [range, periodType, revision]);
    const refresh = useCallback(() => setRevision(value => value + 1), []);
    const periodLabel = { DAILY: '일간', WEEKLY: '주간', MONTHLY: '월간', YEARLY: '연간' }[periodType];
    return <section className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-100 h-full min-h-64" aria-labelledby="qr-statistics-title" aria-busy={loading}>
        <div className="flex items-baseline justify-between gap-3 mb-4">
            <h3 id="qr-statistics-title" className="text-base md:text-lg font-black text-gray-800">QR 페이지 방문</h3>
            <p className="text-xl md:text-2xl font-black text-indigo-500 tabular-nums">{loading ? '…' : error ? '—' : data?.total?.toLocaleString()}<span className="ml-1 text-xs font-bold text-gray-400">회</span></p>
        </div>
        <div className="flex items-baseline justify-between gap-3 mb-3">
            <p className="text-sm text-gray-500">{periodLabel} · {format(range.start, 'yyyy.MM.dd')}{periodType !== 'DAILY' && ` ~ ${format(range.end, 'MM.dd')}`}</p>
            <button onClick={refresh} disabled={loading} className="text-xs font-bold text-blue-600 disabled:opacity-50">새로고침</button>
        </div>
        {error ? <p role="alert" className="py-8 text-sm text-red-600">{error}</p> : loading ? <p role="status" className="py-8 text-sm text-gray-500">방문 집계를 불러오는 중…</p> : data?.total === 0 ? <div className="h-40 flex items-center justify-center text-sm text-gray-500">선택한 기간의 QR 방문이 없습니다.</div> : <div className="h-44">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={data?.points || []}><XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={value => [`${value}회`, '방문']} /><Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </div>}
        <p className="mt-3 text-xs text-gray-500">QR 전용 주소 · 브라우저당 하루 1회 · 한국 시간 기준 · 운영자 제외</p>
    </section>;
}

