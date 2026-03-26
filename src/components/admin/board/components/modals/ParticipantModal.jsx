import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, ClipboardList } from 'lucide-react';
import useParticipantManagement from '../../hooks/useParticipantManagement';
import { exportParticipantsToExcel } from '../../../../../utils/exportUtils';

import AttendanceSection from './AttendanceSection';
import WalkInSection from './WalkInSection';
import PollResultsSection from './PollResultsSection';

const ParticipantModal = ({ notice, onClose, onRefresh }) => {
    const {
        participantList,
        pollModalResults,
        modalLoading,
        fetchParticipants,
        handleAttendanceToggle,
        handleDeleteParticipant,
        handleMarkAllAttended,
        searchQuery,
        setSearchQuery,
        searchResults,
        handleUserSearch,
        showEntranceList,
        setShowEntranceList,
        lastAddedUser,
        addWalkIn
    } = useParticipantManagement(notice, onRefresh);

    useEffect(() => {
        if (notice) {
            fetchParticipants(notice);
        }
    }, [notice, fetchParticipants]);

    if (!notice) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 md:p-6 backdrop-blur-sm animate-fade-in dropdown-overlay">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
                
                {/* Mobile Header (Hidden on md+) */}
                <div className="md:hidden flex justify-between items-center p-4 border-b border-gray-100 bg-white z-10">
                    <h2 className="font-bold text-lg text-gray-800 tracking-tight truncate pr-4">
                        {notice.title} 
                        {notice.is_poll ? ' 투표 결과' : ' 참여자 명단'}
                    </h2>
                    <button onClick={onClose} className="p-2 bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full shrink-0">
                        <X size={20} />
                    </button>
                </div>

                {/* Desktop Sidebar (Hidden on mobile) */}
                <div className="hidden md:flex w-72 bg-gray-50 flex-col border-r border-gray-100">
                    <div className="p-6 border-b border-gray-200/60 bg-white">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="font-black text-xl text-gray-800 tracking-tight leading-snug">
                                {notice.title}
                            </h2>
                        </div>
                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold shadow-sm">
                            {notice.is_poll ? '투표/설문' : '참석 여부 관리'}
                        </span>
                    </div>

                    {!notice.is_poll && (
                        <div className="p-6 flex-1 text-sm text-gray-500 space-y-4 font-medium">
                            <p>학생들의 참석 여부를 확인하고<br/>수동으로 출석 체크 할 수 있습니다.</p>
                            <p>사전 신청하지 않은 학생은<br/>'상단 버튼'을 클릭하여<br/>현장에서 바로 추가 가능합니다.</p>
                            
                            <button 
                                onClick={() => exportParticipantsToExcel(participantList.JOIN, notice.title)}
                                className="w-full py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl flex justify-center items-center gap-2 font-bold transition mt-4 border border-green-200 shadow-sm"
                            >
                                <ClipboardList size={16} /> 엑셀 다운로드
                            </button>
                        </div>
                    )}
                    
                    <div className="p-6 bg-gray-100 border-t border-gray-200/50 mt-auto">
                        <button 
                            onClick={onClose}
                            className="w-full py-3 bg-white text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition border border-gray-200 shadow-sm"
                        >
                            닫기
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-h-0 bg-white relative">
                    {modalLoading ? (
                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : (
                        notice.is_poll ? (
                            <PollResultsSection 
                                notice={notice} 
                                pollModalResults={pollModalResults} 
                            />
                        ) : (
                            showEntranceList ? (
                                <WalkInSection 
                                    searchQuery={searchQuery}
                                    handleUserSearch={handleUserSearch}
                                    searchResults={searchResults}
                                    addWalkIn={addWalkIn}
                                    lastAddedUser={lastAddedUser}
                                    activeUsersCount={participantList.JOIN?.filter(u => u.is_attended).length || 0}
                                    setShowEntranceList={setShowEntranceList}
                                />
                            ) : (
                                <>
                                    {/* Mobile Excel Button */}
                                    <div className="md:hidden p-4 border-b border-gray-100 bg-white flex justify-end">
                                        <button 
                                            onClick={() => exportParticipantsToExcel(participantList.JOIN, notice.title)}
                                            className="px-4 py-2 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 font-bold text-xs border border-green-200"
                                        >
                                            <ClipboardList size={14} /> 엑셀 다운로드
                                        </button>
                                    </div>
                                    <AttendanceSection 
                                        notice={notice}
                                        participantList={participantList}
                                        onAttendanceToggle={handleAttendanceToggle}
                                        onDeleteParticipant={handleDeleteParticipant}
                                        onMarkAllAttended={handleMarkAllAttended}
                                        showEntranceList={showEntranceList}
                                        setShowEntranceList={setShowEntranceList}
                                    />
                                </>
                            )
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

ParticipantModal.propTypes = {
    notice: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    onRefresh: PropTypes.func
};

export default React.memo(ParticipantModal);
