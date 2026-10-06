import UserCategoryBadge from '../../common/UserCategoryBadge';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpDown, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import useAdminUsers from './hooks/useAdminUsers';
import UserFilters from './components/UserFilters';
import UserEditModal from './modals/UserEditModal';
import UserMergeModal from './modals/UserMergeModal';
import ImageOverlayModal from './modals/ImageOverlayModal';
import UserAvatar from '../../common/UserAvatar';
import UserJourneyView from './journey/UserJourneyView';
import useJourneyListStats from './journey/useJourneyListStats';

export default function AdminUserJourney({ users, allLogs, locations, schoolLogs, visitNotes, feedbacks, checkoutSurveyEntries, fetchData, currentAdmin }) {
    const hook = useAdminUsers({ users, allLogs, locations, fetchData, currentAdmin });
    const [selectedUser, setSelectedUser] = useState(null);
    const [sort, setSort] = useState({ key: 'name', direction: 'asc' });
    const listStats = useJourneyListStats(schoolLogs);
    const journeyHistoryRef = useRef(false);

    useEffect(() => {
        const handlePopState = () => {
            journeyHistoryRef.current = false;
            setSelectedUser(null);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        if (!selectedUser) return;
        const latest = users.find(user => user.id === selectedUser.id && user.status !== 'withdrawn');
        if (!latest) setSelectedUser(null);
        else if (latest !== selectedUser) setSelectedUser(latest);
    }, [users, selectedUser]);

    const openJourney = user => {
        window.history.pushState({ ...(window.history.state || {}), adminUserJourneyDetail: true }, '', window.location.href);
        journeyHistoryRef.current = true;
        setSelectedUser(user);
    };

    const closeJourney = () => {
        if (journeyHistoryRef.current && window.history.state?.adminUserJourneyDetail) {
            window.history.back();
        } else {
            journeyHistoryRef.current = false;
            setSelectedUser(null);
        }
    };

    const sortedUsers = useMemo(() => [...hook.filteredUsers].sort((left, right) => {
        let comparison = 0;
        if (sort.key === 'name') comparison = String(left.name || '').localeCompare(String(right.name || ''), 'ko');
        else {
            const leftStats = listStats.stats.get(left.id);
            const rightStats = listStats.stats.get(right.id);
            if (sort.key === 'latest') comparison = String(leftStats?.latest?.date || '').localeCompare(String(rightStats?.latest?.date || ''));
            else comparison = (leftStats?.[sort.key] || 0) - (rightStats?.[sort.key] || 0);
            if (comparison === 0) comparison = String(left.name || '').localeCompare(String(right.name || ''), 'ko');
        }
        return sort.direction === 'asc' ? comparison : -comparison;
    }), [hook.filteredUsers, listStats.stats, sort]);

    const changeSort = key => setSort(current => ({
        key,
        direction: current.key === key ? (current.direction === 'asc' ? 'desc' : 'asc') : (key === 'name' ? 'asc' : 'desc'),
    }));

    const sortIcon = key => sort.key !== key ? <ArrowUpDown size={14} className="text-gray-300" /> : sort.direction === 'asc' ? <ChevronUp size={15} /> : <ChevronDown size={15} />;

    if (selectedUser) return <>
        <UserJourneyView user={selectedUser} allUsers={users} locations={locations} schoolLogs={schoolLogs} visitNotes={visitNotes} feedbacks={feedbacks} checkoutSurveyEntries={checkoutSurveyEntries}
            onBack={closeJourney} onManageAccount={() => hook.setEditingUser(selectedUser)} />
        <UserEditModal editingUser={hook.editingUser} setEditingUser={hook.setEditingUser} handleDeleteUser={hook.handleDeleteUser}
            handleRemoveAdminRole={hook.handleRemoveAdminRole} handleResetPassword={hook.handleResetPassword} handleApproveUser={hook.handleApproveUser}
            userStats={hook.editingUser ? hook.getUserStats(hook.editingUser.id) : null} fetchData={fetchData} setIsMergeModalOpen={hook.setIsMergeModalOpen}
            setViewerImage={hook.setViewerImage} locations={locations} adminUser={currentAdmin} />
        <UserMergeModal isMergeModalOpen={hook.isMergeModalOpen} setIsMergeModalOpen={hook.setIsMergeModalOpen} editingUser={hook.editingUser}
            setEditingUser={hook.setEditingUser} users={users} fetchData={fetchData} />
        <ImageOverlayModal viewerImage={hook.viewerImage} setViewerImage={hook.setViewerImage} />
    </>;

    const shortDate = value => value ? new Date(`${value}T12:00:00+09:00`).toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' }) : '활동 없음';
    const activityMeta = {
        VISIT: { label: '센터 방문', dot: 'bg-sky-500', text: 'text-sky-700' },
        PROGRAM: { label: '프로그램 참여', dot: 'bg-orange-500', text: 'text-orange-700' },
        MEETING: { label: '학생 만남', dot: 'bg-violet-500', text: 'text-violet-700' },
    };

    return <div className="space-y-5">
        <UserFilters users={users} allLogs={allLogs} searchTerm={hook.searchTerm} setSearchTerm={hook.setSearchTerm}
            filterGroup={hook.filterGroup} setFilterGroup={hook.setFilterGroup} filterRegion={hook.filterRegion} setFilterRegion={hook.setFilterRegion}
            excludeLeaders={hook.excludeLeaders} setExcludeLeaders={hook.setExcludeLeaders} showOnlyNonSchoolChurch={hook.showOnlyNonSchoolChurch}
            setShowOnlyNonSchoolChurch={hook.setShowOnlyNonSchoolChurch} showOnlyNew3Months={hook.showOnlyNew3Months} setShowOnlyNew3Months={hook.setShowOnlyNew3Months}
            filteredUsers={hook.filteredUsers} setNotificationModalOpen={hook.setNotificationModalOpen} fetchData={fetchData}
            title="이용자 여정" subtitle="한 사람의 방문, 만남과 프로그램 참여를 시간의 흐름으로 살펴봅니다." showActions={false} compact />

        <section className="overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm">
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[940px] table-fixed">
                    <colgroup><col className="w-[25%]" /><col className="w-[9%]" /><col className="w-[24%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[6%]" /></colgroup>
                    <thead><tr className="border-b border-gray-200 bg-gray-50/80 text-[14px] font-bold text-gray-600">
                        <th className="h-12 px-6 text-left"><button type="button" onClick={() => changeSort('name')} className={`inline-flex items-center gap-1.5 ${sort.key === 'name' ? 'text-blue-700' : ''}`}>이용자{sortIcon('name')}</button></th>
                        <th scope="col" className="h-12 px-3 text-center">구분</th>
                        <th className="h-12 px-5 text-left"><button type="button" onClick={() => changeSort('latest')} className={`inline-flex items-center gap-1.5 ${sort.key === 'latest' ? 'text-blue-700' : ''}`}>최근 활동{sortIcon('latest')}</button></th>
                        {[['visits', '센터 방문'], ['programs', '프로그램'], ['meetings', '학생 만남']].map(([key, label]) => <th key={key} className="h-12 px-2 text-center"><button type="button" onClick={() => changeSort(key)} className={`inline-flex items-center justify-center gap-1.5 ${sort.key === key ? 'text-blue-700' : ''}`}>{label}{sortIcon(key)}</button></th>)}
                        <th><span className="sr-only">상세</span></th>
                    </tr></thead>
                    <tbody>{sortedUsers.map(user => {
                        const counts = listStats.stats.get(user.id);
                        const recent = activityMeta[counts?.latest?.type];
                        const count = key => listStats.loading ? '-' : counts?.[key] || 0;
                        return <tr key={user.id} onClick={() => openJourney(user)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openJourney(user); } }} tabIndex={0} aria-label={`${user.name} 이용자 여정 보기`} className="group cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-slate-50/80 focus-visible:bg-blue-50 focus-visible:outline-none">
                            <td className="px-6 py-3"><div className="flex min-w-0 items-center gap-3.5"><UserAvatar user={user} size="w-11 h-11" textSize="text-sm" /><div className="min-w-0"><div className="flex items-baseline gap-2"><strong className="truncate text-[17px] font-black text-gray-950">{user.name}</strong></div><p className="mt-0.5 flex items-center gap-1 truncate text-[14px] font-medium text-gray-500"><MapPin size={13} className="shrink-0" />{user.schoolDisplayName || user.school || '학교 미지정'}</p></div></div></td>
                            <td className="px-3 py-3 text-center"><UserCategoryBadge user={user} /></td>
                            <td className="px-5 py-3">{listStats.loading ? <span className="text-[14px] font-semibold text-gray-500">확인 중</span> : recent ? <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${recent.dot}`} /><strong className="text-[15px] font-bold text-gray-900">{recent.label}</strong><time className="text-[14px] font-medium text-gray-500">{shortDate(counts.latest.date)}</time></div> : <span className="text-[14px] font-medium text-gray-500">활동 없음</span>}</td>
                            {[['visits', '센터 방문'], ['programs', '프로그램'], ['meetings', '학생 만남']].map(([key, label]) => <td key={key} className="px-2 py-3 text-center"><strong className={`text-[20px] font-bold tabular-nums ${sort.key === key ? 'text-blue-700' : count(key) === 0 ? 'text-gray-500' : 'text-gray-950'}`}>{count(key)}</strong>{!listStats.loading && <span className="ml-0.5 text-[13px] font-medium text-gray-500">회</span>}<span className="sr-only"> {label}</span></td>)}
                            <td className="px-2 py-3 text-center"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition group-hover:bg-blue-600 group-hover:text-white"><ArrowRight size={17} /></span></td>
                        </tr>;
                    })}</tbody>
                </table>
            </div>

            <div className="space-y-3 bg-gray-50/80 p-3 md:hidden">{sortedUsers.map(user => {
                const counts = listStats.stats.get(user.id);
                const recent = activityMeta[counts?.latest?.type];
                return <button key={user.id} type="button" onClick={() => openJourney(user)} className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <div className="flex items-center gap-3 px-4 py-4"><UserAvatar user={user} size="w-12 h-12" textSize="text-sm" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="truncate text-[18px] font-black text-gray-950">{user.name}</strong></div><p className="mt-1 truncate text-[15px] font-medium text-gray-600">{user.schoolDisplayName || user.school || '학교 미지정'}</p></div><ArrowRight size={18} className="text-gray-400" /></div>
                    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3"><span className="text-[13px] font-semibold text-gray-500">구분</span><UserCategoryBadge user={user} /></div>
                    <div className="border-y border-gray-100 bg-gray-50/70 px-4 py-3">
                        <span className="mb-1 block text-[13px] font-semibold text-gray-500">최근 활동</span>
                        {listStats.loading ? <span className="text-[15px] font-semibold text-gray-500">확인 중</span> : recent ? <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${recent.dot}`} /><strong className="text-[15px] font-bold text-gray-900">{recent.label}</strong><time className="ml-auto text-[14px] font-medium text-gray-600">{shortDate(counts.latest.date)}</time></div> : <span className="text-[15px] font-medium text-gray-500">아직 활동이 없습니다</span>}
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-gray-100 px-2 py-3.5">
                        {[['센터 방문', counts?.visits || 0], ['프로그램', counts?.programs || 0], ['학생 만남', counts?.meetings || 0]].map(([label, value]) => <div key={label} className="text-center"><span className="block text-[13px] font-semibold text-gray-600">{label}</span><strong className="mt-1 block text-[19px] font-bold tabular-nums text-gray-900">{listStats.loading ? '-' : value}<span className="ml-0.5 text-[13px] font-medium text-gray-500">회</span></strong></div>)}
                    </div>
                </button>;
            })}</div>
            {!sortedUsers.length && <div className="py-16 text-center text-sm font-bold text-gray-400">조건에 맞는 이용자가 없습니다.</div>}
        </section>
    </div>;
}
