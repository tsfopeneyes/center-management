import React, { useId, useState } from 'react';
import { Search, RefreshCw, FileSpreadsheet, Users, BellRing, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { exportUsersToExcel } from '../../../../utils/exportUtils';
import { USER_GROUPS, GRADE_OPTIONS, VISIT_OPTIONS, userFilterChips } from '../../../../utils/adminUserFilters';
import AdminPageHeader from '../../common/AdminPageHeader';

const choiceClass = selected => 'min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ' + (selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50');
function FilterRow({ label, children, hint }) {
    return <fieldset className="flex min-w-0 flex-col gap-2 py-2.5 sm:flex-row sm:items-start sm:gap-4">
        <legend className="sr-only">{label}</legend>
        <span aria-hidden="true" className="w-20 shrink-0 pt-2 text-sm font-bold text-gray-700">{label}</span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2">{children}</div>{hint && <p className="mt-2 text-xs leading-5 text-gray-600">{hint}</p>}</div>
    </fieldset>;
}
export default function UserFilters({ allLogs = [], searchTerm, setSearchTerm, filters, setFilters, resetFilters, filteredUsers = [], setNotificationModalOpen, fetchData, visitStatus = 'ready', retryVisits, title = '이용자 관리', subtitle = '전체 회원 목록 조회 및 정보 수정', showActions = true, showSearch = true, compact = false }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const panelId = useId();
    const update = (key, value) => setFilters(current => ({ ...current, [key]: value, ...(key === 'schoolChurch' && value === 'NO' ? { leader: 'ALL' } : {}) }));
    const chips = userFilterChips(filters, searchTerm);
    const visitPending = filters.visit !== 'ALL' && visitStatus !== 'ready';
    const detailCount = Number(filters.joined !== 'ALL') + Number(filters.visit !== 'ALL') + Number(Boolean(filters.grades?.length));
    const invalidDates = filters.joined === 'CUSTOM' && filters.start && filters.end && filters.start > filters.end;
    const remove = key => {
        if (key === 'search') return setSearchTerm('');
        if (key.startsWith('grade:')) return update('grades', filters.grades.filter(grade => grade !== key.slice(6)));
        if (key.startsWith('group:')) return update('groups', filters.groups.filter(group => group !== key.slice(6)));
        if (key === 'joined') return setFilters(current => ({ ...current, joined: 'ALL', start: '', end: '' }));
        update(key, 'ALL');
    };
    const choices = (key, options) => options.map(([value, label]) => <button key={value} type="button" aria-pressed={filters[key] === value} onClick={() => update(key, value)} className={choiceClass(filters[key] === value)}>{label}</button>);
    return <div className="space-y-4 md:space-y-6">
        <AdminPageHeader title={title} subtitle={subtitle} icon={<Users />} compact={compact} actions={(showSearch || showActions) ? <div className="flex w-full items-center gap-2 sm:gap-3 lg:w-auto">
            {showSearch && <div className="relative min-w-0 flex-1 lg:min-w-[280px]"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input aria-label="이용자 검색" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="이름, 학교, 연락처 검색" className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-800 placeholder:text-gray-500 focus:border-blue-600 focus:outline-none" /></div>}
            {showActions && <><button type="button" aria-label="결과 내보내기" disabled={!filteredUsers.length || Boolean(invalidDates) || visitPending} onClick={() => exportUsersToExcel(filteredUsers, allLogs)} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-green-200 bg-white px-3 py-2 text-sm font-bold text-green-700 hover:bg-green-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4" title="현재 조회된 이용자만 엑셀로 저장"><FileSpreadsheet size={17} /><span className="hidden sm:inline">결과 내보내기</span></button><button type="button" aria-label="알림 발송" onClick={() => setNotificationModalOpen(true)} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 sm:px-4"><BellRing size={17} /><span className="hidden sm:inline">알림 발송</span></button></>}
        </div> : null} />
        <section aria-label="이용자 필터" className="rounded-2xl border border-gray-200 bg-white px-4 sm:px-5">
            <div className="flex min-h-14 items-center justify-between gap-3 md:hidden">
                <button type="button" aria-expanded={mobileOpen} aria-controls={panelId} onClick={() => setMobileOpen(open => !open)} className="flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><SlidersHorizontal size={16}/><span>필터</span>{chips.length > 0 && <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">{chips.length}</span>}<ChevronDown size={14} className={mobileOpen ? 'rotate-180' : ''}/></button>
                <div className="flex items-center gap-2"><span role="status" aria-live="polite" className="text-sm font-bold text-blue-700">{visitPending ? (visitStatus === 'error' ? '조회 실패' : '조회 중') : `${filteredUsers.length}명`}</span><button type="button" onClick={fetchData} aria-label="이용자 새로고침" className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50"><RefreshCw size={16}/></button></div>
            </div>
            <div id={panelId} className={`${mobileOpen ? 'block' : 'hidden'} border-t border-gray-100 md:block md:border-t-0`}>
            <div className="divide-y divide-gray-100">
                <FilterRow label="학교 지역">{choices('region', [['ALL', '전체'], ['강동', '강동'], ['강서', '강서'], ['미지정', '미지정']])}</FilterRow>
                <FilterRow label="이용자 유형">
                    <button type="button" className={choiceClass(!filters.groups.length)} aria-pressed={!filters.groups.length} onClick={() => update('groups', [])}>전체</button>
                    {USER_GROUPS.map(group => <button key={group} type="button" className={choiceClass(filters.groups.includes(group))} aria-pressed={filters.groups.includes(group)} onClick={() => update('groups', filters.groups.includes(group) ? filters.groups.filter(item => item !== group) : [...filters.groups, group])}>{group}</button>)}
                </FilterRow>
                <div className="grid gap-x-8 lg:grid-cols-[max-content_1fr]">
                <FilterRow label="스쿨처치">{choices('schoolChurch', [['ALL', '전체'], ['YES', '참여'], ['NO', '미참여']])}</FilterRow>
                {filters.schoolChurch !== 'NO' && <FilterRow label="리더 여부">{choices('leader', [['ALL', '전체'], ['YES', '리더'], ['NO', '리더 아님']])}</FilterRow>}
                </div>
            </div>
            <details className="group border-t border-gray-100">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-gray-600 hover:text-blue-700 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden"><SlidersHorizontal size={15} /><span>상세 필터</span>{(detailCount > 0) && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-800">{detailCount}개 적용</span>}<ChevronDown size={15} className="ml-auto transition-transform group-open:rotate-180" /></summary>
                <div className="divide-y divide-gray-100 pb-2">
                <FilterRow label="가입 기간">
                    {choices('joined', [['ALL', '전체'], ['1M', '최근 1개월'], ['3M', '최근 3개월'], ['CUSTOM', '직접 지정']])}
                    {filters.joined === 'CUSTOM' && <div className="flex w-full flex-wrap items-center gap-2 pt-1"><label className="flex items-center gap-2 text-sm text-gray-700">시작일<input type="date" value={filters.start} onChange={event => update('start', event.target.value)} aria-invalid={Boolean(invalidDates)} aria-describedby={invalidDates ? 'user-filter-date-error' : undefined} className="min-h-10 min-w-0 rounded-lg border border-gray-300 px-2 text-sm" /></label><label className="flex items-center gap-2 text-sm text-gray-700">종료일<input type="date" value={filters.end} onChange={event => update('end', event.target.value)} aria-invalid={Boolean(invalidDates)} aria-describedby={invalidDates ? 'user-filter-date-error' : undefined} className="min-h-10 min-w-0 rounded-lg border border-gray-300 px-2 text-sm" /></label><p className="w-full text-xs text-gray-600">한국 시간 기준이며, 시작일과 종료일을 모두 포함합니다. 비워 둔 쪽은 기간을 제한하지 않습니다.</p>{invalidDates && <p id="user-filter-date-error" role="alert" className="w-full text-sm font-semibold text-red-700">종료일을 시작일과 같거나 이후로 선택해 주세요.</p>}</div>}
                </FilterRow>
                <FilterRow label="최근 센터 방문" hint="전체 센터의 입실 기록 기준 · 최근 기간은 오늘을 포함합니다. 방문 기록 없음은 저장된 입실 기록이 없는 경우입니다.">
                    {choices('visit', VISIT_OPTIONS)}
                    {visitPending && <div className="w-full text-sm text-gray-600" role="status">{visitStatus === 'error' ? <span className="text-red-700">입실 기록을 불러오지 못했습니다. <button type="button" onClick={retryVisits} className="min-h-9 px-2 font-bold underline">다시 불러오기</button></span> : '입실 기록을 확인하고 있습니다…'}</div>}
                </FilterRow>
                <FilterRow label="나이대" hint="생년월일 기준의 일반 진학 나이대이며 실제 학년과 다를 수 있습니다. 매년 3월 기준으로 변경되며 여러 개를 선택할 수 있습니다.">
                    <button type="button" className={choiceClass(!filters.grades?.length)} aria-pressed={!filters.grades?.length} onClick={() => update('grades', [])}>전체</button>
                    {GRADE_OPTIONS.map(grade => <button key={grade} type="button" className={choiceClass(filters.grades?.includes(grade))} aria-pressed={Boolean(filters.grades?.includes(grade))} onClick={() => update('grades', filters.grades?.includes(grade) ? filters.grades.filter(item => item !== grade) : [...(filters.grades || []), grade])}>{grade}</button>)}
                </FilterRow>
                </div>
            </details>
            <button type="button" onClick={() => setMobileOpen(false)} className="mb-3 mt-2 min-h-10 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 md:hidden">필터 접기</button>
            </div>
            {chips.length > 0 && <div className="flex items-center gap-2 overflow-x-auto border-t border-gray-100 py-2 md:hidden">{chips.map(chip => <button key={chip.key} type="button" onClick={() => remove(chip.key)} aria-label={chip.label + ' 조건 해제'} className="flex min-h-8 shrink-0 items-center gap-1 rounded-md bg-blue-50 px-2 text-xs font-semibold text-blue-800">{chip.label}<X size={12}/></button>)}<button type="button" onClick={resetFilters} className="min-h-8 shrink-0 px-1 text-xs font-semibold text-gray-600 underline underline-offset-2">초기화</button></div>}
            <div className="hidden flex-wrap items-center justify-between gap-3 border-t border-gray-200 py-3 md:flex">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2"><span className="text-xs font-bold text-gray-600">적용 조건</span>{chips.length ? chips.map(chip => <button key={chip.key} type="button" onClick={() => remove(chip.key)} aria-label={chip.label + ' 조건 해제'} className="flex min-h-8 max-w-full items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"><span className="break-all">{chip.label}</span><X size={13} className="shrink-0" /></button>) : <span className="text-sm text-gray-600">전체 이용자 · 게스트 제외</span>}{chips.length > 0 && <button type="button" onClick={resetFilters} className="min-h-8 px-2 text-xs font-bold text-gray-600 underline underline-offset-4 hover:text-gray-900">전체 초기화</button>}</div>
                <div className="flex shrink-0 items-center gap-3"><span role="status" aria-live="polite" className="flex items-center gap-1.5 text-sm font-bold text-blue-700"><Users size={16} />{visitPending ? (visitStatus === 'error' ? '조회 실패' : '조회 중') : filteredUsers.length + '명'}</span><button type="button" onClick={fetchData} title="새로고침" aria-label="이용자 새로고침" className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"><RefreshCw size={16} /></button></div>
            </div>
        </section>
    </div>;
}
