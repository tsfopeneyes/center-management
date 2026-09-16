import React from 'react';
import { getRecruitment } from '../../../utils/programRecruitment';

export default function RecruitmentBadge({ program, now, showStart = false }) {
    const state = getRecruitment(program, now);
    if (!state.label) return null;
    const isSessionOpen = state.status === 'OPEN' && state.label.includes('회차');
    const color = state.status === 'SCHEDULED'
        ? 'border border-amber-200 bg-amber-50 text-amber-800'
        : isSessionOpen
            ? 'border border-[#E6C63C] bg-[#F8DF53] text-[#5A4610]'
            : state.status === 'OPEN'
                ? 'border border-[#CF3A27] bg-[#CF3A27] text-white'
                : 'border border-slate-200 bg-slate-100 text-slate-500';
    return <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className={`rounded-md px-2 py-1 text-[10px] font-bold whitespace-nowrap ${color}`}>{state.label}</span>
        {showStart && state.status === 'SCHEDULED' && <span className="text-xs font-semibold text-amber-700">{state.message}</span>}
    </span>;
}
