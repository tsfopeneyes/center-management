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

        <section className="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm">
            <div className="hidden grid-cols-[minmax(250px,1fr)_minmax(220px,.8fr)_repeat(3,minmax(95px,.35fr))_44px] items-center gap-4 border-b border-gray-100 bg-gray-50/70 px-6 py-2.5 text-[13px] font-bold text-gray-500 md:grid">
                <button type="button" onClick={() => changeSort('name')} className={`flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-white ${sort.key === 'name' ? 'text-blue-700' : ''}`}>이용자 {sortIcon('name')}</button>
                <button type="button" onClick={() => changeSort('latest')} className={`flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-white ${sort.key === 'latest' ? 'text-blue-700' : ''}`}>최근 활동 {sortIcon('latest')}</button>
                <button type="button" onClick={() => changeSort('visits')} className={`mx-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-black text-sky-700 hover:bg-sky-50 ${sort.key === 'visits' ? 'bg-sky-50' : ''}`}>센터 방문 {sortIcon('visits')}</button>
                <button type="button" onClick={() => changeSort('programs')} className={`mx-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-black text-orange-700 hover:bg-orange-50 ${sort.key === 'programs' ? 'bg-orange-50' : ''}`}>프로그램 {sortIcon('programs')}</button>
                <button type="button" onClick={() => changeSort('meetings')} className={`mx-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-black text-violet-700 hover:bg-violet-50 ${sort.key === 'meetings' ? 'bg-violet-50' : ''}`}>학생 만남 {sortIcon('meetings')}</button>
                <span className="sr-only">상세</span>
            </div>
            {sortedUsers.length ? sortedUsers.map(user => {
                const counts = listStats.stats.get(user.id);
                const countLabel = value => listStats.loading ? '–' : value || 0;
                const recent = activityMeta[counts?.latest?.type];
                return <button key={user.id} type="button" onClick={() => openJourney(user)} className="group grid w-full items-center gap-4 border-b border-gray-100 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-blue-50/40 focus-visible:bg-blue-50 focus-visible:outline-none md:grid-cols-[minmax(250px,1fr)_minmax(220px,.8fr)_repeat(3,minmax(95px,.35fr))_44px] md:px-6 md:py-4">
                <span className="flex min-w-0 items-center gap-3.5"><UserAvatar user={user} size="w-11 h-11" textSize="text-sm" /><span className="min-w-0"><span className="flex items-center gap-2"><strong className="truncate text-base font-black text-gray-900">{user.name}</strong><em className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-xs not-italic font-bold text-gray-500">{user.user_group || '미지정'}</em></span><span className="mt-1 flex items-center gap-1 truncate text-[13px] font-semibold text-gray-500"><MapPin size={13} />{user.schoolDisplayName || user.school || '학교 미지정'}</span></span></span>
                <span className="min-w-0">{listStats.loading ? <span className="text-sm font-bold text-gray-400">확인 중</span> : recent ? <span className="inline-flex max-w-full items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"><i className={`h-2.5 w-2.5 shrink-0 rounded-full ${recent.dot}`} /><strong className={`truncate text-[15px] font-black ${recent.text}`}>{recent.label}</strong><time className="shrink-0 border-l border-gray-200 pl-2 text-[13px] font-bold text-gray-600">{shortDate(counts.latest.date)}</time></span> : <span className="text-sm font-bold text-gray-400">활동 없음</span>}</span>
                <span className="grid grid-cols-3 divide-x divide-gray-100 rounded-xl bg-gray-50 py-2 md:hidden">{[['방문', counts?.visits], ['프로그램', counts?.programs], ['만남', counts?.meetings]].map(([label, value]) => <span key={label} className="text-center"><small className="block text-xs font-bold text-gray-500">{label}</small><strong className="text-base font-black text-gray-900">{countLabel(value)}{!listStats.loading && '회'}</strong></span>)}</span>
                <span className="hidden justify-self-center rounded-xl border border-sky-100 bg-sky-50 px-4 py-2 text-center text-base font-black text-sky-900 md:block md:min-w-[72px]">{countLabel(counts?.visits)}{!listStats.loading && <small className="ml-0.5 text-xs font-bold text-sky-700">회</small>}</span>
                <span className="hidden justify-self-center rounded-xl border border-orange-100 bg-orange-50 px-4 py-2 text-center text-base font-black text-orange-900 md:block md:min-w-[72px]">{countLabel(counts?.programs)}{!listStats.loading && <small className="ml-0.5 text-xs font-bold text-orange-700">회</small>}</span>
                <span className="hidden justify-self-center rounded-xl border border-violet-100 bg-violet-50 px-4 py-2 text-center text-base font-black text-violet-900 md:block md:min-w-[72px]">{countLabel(counts?.meetings)}{!listStats.loading && <small className="ml-0.5 text-xs font-bold text-violet-700">회</small>}</span>
                <span className="flex h-9 w-9 items-center justify-center justify-self-end rounded-full border border-gray-200 bg-white text-gray-400 transition group-hover:border-blue-200 group-hover:text-blue-600"><ArrowRight size={16} /></span>
            </button>}) : <div className="py-16 text-center text-sm font-bold text-slate-400">조건에 맞는 이용자가 없습니다.</div>}
        </section>
    </div>;
}
