import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { X, Users, CalendarDays } from 'lucide-react';
import useParticipantManagement from '../../hooks/useParticipantManagement';
import useModalClose from '../../../../../hooks/useModalClose';

import AttendanceSection from './AttendanceSection';
import WalkInSection from './WalkInSection';
import PollResultsSection from './PollResultsSection';
import ChallengeStatusSection from './ChallengeStatusSection';
import ChallengeCommunityModal from '../../../../student/modals/ChallengeCommunityModal';
import UserEditModal from '../../../users/modals/UserEditModal';
import { supabase } from '../../../../../supabaseClient';
import { usesDailySessionRsvp } from '../../../../../utils/dailyProgramSessions';

const ParticipantModal = ({ notice, user, onClose, onRefresh, initialView }) => {
    const {
        participantList,
        pollModalResults,
        modalLoading,
        fetchParticipants,
        handleAttendanceToggle,
        handleStaffToggle,
        handleDeleteParticipant,
        handleMarkAllAttended,
        searchQuery,
        setSearchQuery,
        searchResults,
        handleUserSearch,
        showEntranceList,
        setShowEntranceList,
        lastAddedUser,
        addWalkIn,
        addMultipleWalkIns,
        activeSpaceUsers,
        selectedDate,
        setSelectedDate,
        availableDates
    } = useParticipantManagement(notice, onRefresh);
    const [activeView, setActiveView] = useState(() => {
        if (initialView) return initialView;
        if (notice?._initialView) return notice._initialView;
        if (notice?.is_poll) return 'poll';
        if (notice?.is_challenge) return 'challenge';
        return 'attendance';
    });
    const [selectedUserForModal, setSelectedUserForModal] = useState(null);
    const [hasQuestionColumns, setHasQuestionColumns] = useState(false);
    const [missionPostFilter, setMissionPostFilter] = useState(null);
    useModalClose(!!notice, onClose, { priority: 150 });

    useEffect(() => {
        const targetView = initialView || notice?._initialView;
        if (targetView) {
            setActiveView(targetView);
        }
    }, [initialView, notice?._initialView]);

    useEffect(() => {
        if (notice?._initialSessionDate) setSelectedDate(notice._initialSessionDate);
    }, [notice?._initialSessionDate, setSelectedDate]);

    const handleUserClick = async (user) => {
        if (!user || !user.id) return;
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();
            if (data) {
                setSelectedUserForModal(data);
            } else {
                setSelectedUserForModal(user);
            }
        } catch (err) {
            console.error('Failed to fetch full user detail:', err);
            setSelectedUserForModal(user);
        }
    };

    useEffect(() => {
        if (notice) {
            fetchParticipants(notice);
        }
    }, [notice, fetchParticipants]);

    if (!notice) return null;

    const hasMultipleViews = Boolean(notice.is_poll || notice.is_challenge);

    return createPortal(
        <div onClick={event => { if (event.target === event.currentTarget && !selectedUserForModal && !missionPostFilter) onClose(); }} className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center p-4 md:p-6 ">
            <div role="dialog" aria-modal="true" aria-label={notice.title + ' 참여자 명단'} className={`flex max-h-[90dvh] w-full ${hasQuestionColumns || activeView !== 'attendance' || showEntranceList ? 'max-w-6xl' : 'max-w-3xl'} flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl`} onClick={e => e.stopPropagation()}>
                <div className="flex shrink-0 items-center justify-between gap-4 bg-[#f9fafb] px-5 py-5 md:px-7">
                    <div className="flex min-w-0 items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F4DDD4] text-[#CF3A27]"><Users size={24} /></span>
                    <h2 className="min-w-0 truncate text-lg font-bold text-slate-900 md:text-xl">{notice.title}</h2></div>
                    <button type="button" onClick={onClose} aria-label="명단 창 닫기" className="shrink-0 rounded-full bg-white p-2.5 text-slate-500 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-[#CF3A27]"><X size={20} /></button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-h-0 bg-white relative">
                    {hasMultipleViews && !showEntranceList && (
                        <div className="flex shrink-0 border-b border-slate-100 bg-white px-4 md:px-6">
                            <button
                                onClick={() => setActiveView('attendance')}
                                className={`border-b-2 px-4 py-3 text-center text-sm font-semibold transition-colors ${
                                    activeView === 'attendance'
                                        ? 'border-[#CF3A27] text-[#CF3A27]'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                명단 및 출석 관리
                            </button>
                            {notice.is_poll && (
                                <button
                                    onClick={() => setActiveView('poll')}
                                    className={`border-b-2 px-4 py-3 text-center text-sm font-semibold transition-colors ${
                                        activeView === 'poll'
                                            ? 'border-[#CF3A27] text-[#CF3A27]'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    투표 결과
                                </button>
                            )}
                            {notice.is_challenge && (
                                <button
                                    onClick={() => setActiveView('challenge')}
                                    className={`border-b-2 px-4 py-3 text-center text-sm font-semibold transition-colors ${
                                        activeView === 'challenge'
                                            ? 'border-[#CF3A27] text-[#CF3A27]'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    미션 인증 현황
                                </button>
                            )}
                        </div>
                    )}

                    {activeView !== 'poll' && (notice.is_recruiting === false || usesDailySessionRsvp(notice) || availableDates.length > 0) && (
                        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-3 md:px-6">
                            <CalendarDays size={18} className="text-[#CF3A27]" /><label htmlFor="participant-date" className="text-sm font-medium text-slate-600">조회·등록 날짜</label>
                            {availableDates.length > 0 ? (
                                <select id="participant-date" value={selectedDate || ''} onChange={event => setSelectedDate(event.target.value)}
                                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-[#CF3A27] focus:outline-none">
                                    {availableDates.map(date => <option key={date} value={date}>{date}</option>)}
                                </select>
                            ) : (
                                <input id="participant-date" type="date" value={selectedDate || ''} onChange={event => setSelectedDate(event.target.value)}
                                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-[#CF3A27] focus:outline-none" />
                            )}
                        </div>
                    )}

                    {modalLoading ? (
                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#CF3A27]"></div>
                        </div>
                    ) : activeView === 'poll' ? (
                        <PollResultsSection
                            notice={notice}
                            pollModalResults={pollModalResults}
                        />
                    ) : showEntranceList ? (
                        <WalkInSection
                            searchQuery={searchQuery}
                            handleUserSearch={handleUserSearch}
                            searchResults={searchResults}
                            addWalkIn={addWalkIn}
                            addMultipleWalkIns={addMultipleWalkIns}
                            lastAddedUser={lastAddedUser}
                            activeUsersCount={participantList.JOIN?.filter(u => u.is_attended).length || 0}
                            setShowEntranceList={setShowEntranceList}
                            activeSpaceUsers={activeSpaceUsers}
                            alreadyJoinedUserIds={new Set((participantList.JOIN || []).map(u => u.id))}
                        />
                    ) : (notice.is_challenge && activeView === 'challenge') ? (
                        <ChallengeStatusSection
                            notice={notice}
                            participantList={participantList}
                            onRefresh={() => fetchParticipants(notice)}
                            onUserClick={handleUserClick}
                            onOpenMissionPosts={(student, mission) => setMissionPostFilter({
                                participantId: student.id,
                                participantName: student.name,
                                missionId: mission.id,
                                missionTitle: mission.title,
                                locked: true,
                            })}
                        />
                    ) : (
                        <AttendanceSection
                            notice={notice}
                            participantList={participantList}
                            onAttendanceToggle={handleAttendanceToggle}
                            onStaffToggle={handleStaffToggle}
                            onDeleteParticipant={handleDeleteParticipant}
                            onMarkAllAttended={handleMarkAllAttended}
                            setShowEntranceList={setShowEntranceList}
                            selectedDate={selectedDate}
                            availableDates={availableDates}
                            onColumnsChange={setHasQuestionColumns}
                            onUserClick={handleUserClick}
                        />
                    )}
                </div>
            </div>

            {selectedUserForModal && (
                <UserEditModal
                    editingUser={selectedUserForModal}
                    setEditingUser={setSelectedUserForModal}
                    fetchData={() => {
                        if (notice) fetchParticipants(notice);
                        if (onRefresh) onRefresh();
                    }}
                />
            )}
            {missionPostFilter && user && (
                <ChallengeCommunityModal
                    notice={notice}
                    user={user}
                    initialFilter={missionPostFilter}
                    onClose={() => setMissionPostFilter(null)}
                    onMissionCompleted={() => fetchParticipants(notice)}
                />
            )}
        </div>, document.body
    );
};

ParticipantModal.propTypes = {
    notice: PropTypes.object.isRequired,
    user: PropTypes.object,
    onClose: PropTypes.func.isRequired,
    onRefresh: PropTypes.func
};

export default React.memo(ParticipantModal);
