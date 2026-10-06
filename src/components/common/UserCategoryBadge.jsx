import React from 'react';
import { getUserCategory } from '../../utils/userCategory';

const colors = {
    '리더': 'bg-[#F8E8E4] text-[#B93223]',
    '청소년': 'bg-[#DDEEE2] text-[#28613C]',
    '게스트': 'bg-[#DFEAF8] text-[#305D98]',
    '졸업생': 'bg-slate-100 text-slate-600',
    STAFF: 'bg-violet-50 text-violet-700',
};
export default function UserCategoryBadge({ user, className = '' }) {
    const category = getUserCategory(user);
    return <span aria-label={`구분: ${category}`} className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold leading-none ${colors[category] || 'bg-slate-100 text-slate-600'} ${className}`}>{category}</span>;
}
